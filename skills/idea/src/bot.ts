import { AbortError } from '@anthropic-ai/claude-agent-sdk';
import { Bot, GrammyError } from 'grammy';
import { abortRunning, probeAgent, runTurn } from './agent.js';
import { loadConfig, REQUIRED_SKILLS } from './config.js';
import { chunkMarkdown, toTelegramHtml } from './format.js';
import { checkSkills, formatReport } from './skill-check.js';
import * as store from './store.js';

const STAGE_LABEL: Record<store.Stage, string> = {
  'awaiting-brief': 'waiting for the track brief',
  'needs-ideas': 'track card saved, ideas next',
  'awaiting-pick': 'ideas scored, waiting for your pick',
  discussing: 'remixed, discussing',
};

const HELP = `I brainstorm hackathon ideas with you, one hackathon at a time.

/new <name> — start a hackathon (paste the track brief on the next lines or in the next message)
/open <name> — switch to a saved hackathon
/list — saved hackathons
/status — current hackathon, stage and files
/stop — wrap up and save the discussion summary
/cancel — stop the reply in progress
/skills — skill dependency check

Flow: brief → track card → scored ideas → you pick one → remix → discuss until you /stop.
Everything is saved under ideas/<name>/.`;

async function main() {
  const cfg = loadConfig();

  const report = checkSkills();
  console.log(formatReport(report));
  if (report.missingRequired.length) {
    throw new Error(`Required skills are not installed: ${report.missingRequired.join(', ')}`);
  }

  const probe = await probeAgent(cfg);
  const notLoaded = REQUIRED_SKILLS.filter((s) => !probe.skills.includes(s));
  if (notLoaded.length) throw new Error(`Claude Code did not load these skills: ${notLoaded.join(', ')}`);
  if (probe.apiKeySource && probe.apiKeySource !== 'ANTHROPIC_API_KEY') {
    throw new Error(`Claude Code is authenticating via "${probe.apiKeySource}" instead of ANTHROPIC_API_KEY from .env.`);
  }
  console.log(`Claude Code ${probe.version ?? '?'} loaded skills: ${REQUIRED_SKILLS.join(', ')} (key: ${probe.apiKeySource ?? 'unknown'})`);

  const bot = new Bot(cfg.botToken);
  await bot.init(); // validates the token
  const chatId = cfg.userId; // private chat with the owner, so chat ID == user ID

  let active = await store.readActive();
  let orphanBrief: string | null = null; // text sent before any hackathon was active
  let pending: string[] = []; // Telegram splits long pastes into several messages; these get merged
  let debounce: NodeJS.Timeout | undefined;
  let chain: Promise<void> = Promise.resolve();

  const send = async (md: string, quiet = false) => {
    for (const chunk of chunkMarkdown(md)) {
      const opts = { link_preview_options: { is_disabled: true }, disable_notification: quiet };
      try {
        await bot.api.sendMessage(chatId, toTelegramHtml(chunk), { ...opts, parse_mode: 'HTML' });
      } catch (err) {
        if (!(err instanceof GrammyError && err.error_code === 400)) throw err;
        await bot.api.sendMessage(chatId, chunk, opts); // HTML rejected: fall back to plain text
      }
    }
  };
  const note = (md: string) => send(md, true).catch((err) => console.error('[telegram]', err));

  /** Runs tasks one at a time so turns, switches and /stop never overlap. */
  const serial = (task: () => Promise<void>) => {
    chain = chain.then(task).catch(async (err) => {
      if (err instanceof AbortError) return; // /cancel already answered
      console.error(err);
      await note(`⚠️ ${err instanceof Error ? err.message : String(err)}`);
    });
  };

  const agentTurn = async (slug: string, text: string) => {
    const typing = setInterval(() => void bot.api.sendChatAction(chatId, 'typing').catch(() => {}), 4500);
    void bot.api.sendChatAction(chatId, 'typing').catch(() => {});
    const saved = new Set<string>();
    try {
      const reply = await runTurn(cfg, slug, text, {
        onSkill: (name) => note(`› skill: ${name}`),
        onSaved: async (file) => {
          if (!saved.has(file)) await note(`› saved ${file}`);
          saved.add(file);
        },
      });
      await send(reply);
    } finally {
      clearInterval(typing);
    }
  };

  const handleText = async (text: string) => {
    if (!active) {
      orphanBrief = text;
      await send('No hackathon is active. Send /new <name> and I will use what you just sent as the brief, or /open <name> to continue a saved one.');
      return;
    }
    const slug = active;
    const before = store.stageOf(slug);
    await agentTurn(slug, text);
    // Brief just turned into a track card: go straight on to generating and scoring ideas.
    if (before === 'awaiting-brief' && store.stageOf(slug) === 'needs-ideas') {
      await agentTurn(slug, 'Track card saved. Continue with step 2: generate and score ideas now.');
    }
  };

  const flushPending = () => {
    clearTimeout(debounce);
    if (!pending.length) return;
    const text = pending.join('\n\n');
    pending = [];
    serial(() => handleText(text));
  };
  const enqueueText = (text: string) => {
    pending.push(text);
    clearTimeout(debounce);
    debounce = setTimeout(flushPending, 1500);
  };

  const activate = async (slug: string | null) => {
    active = slug;
    await store.writeActive(slug);
  };

  // Owner-only: drop everything that isn't the owner's private chat.
  bot.use(async (ctx, next) => {
    if (ctx.from?.id !== cfg.userId || ctx.chat?.type !== 'private') {
      console.log(`[telegram] ignored update from user ${ctx.from?.id ?? '?'} (${ctx.chat?.type ?? 'no chat'})`);
      return;
    }
    await next();
  });

  bot.command(['start', 'help'], () => send(HELP));

  bot.command('new', (ctx) => {
    flushPending();
    const [nameLine = '', ...rest] = ctx.match.split('\n');
    const slug = store.slugify(nameLine);
    if (!slug) return send('Usage: /new <hackathon name>, with the track brief on the next lines or in your next message.');
    const inlineBrief = rest.join('\n').trim();
    const earlierBrief = orphanBrief;
    orphanBrief = null;
    serial(async () => {
      const existed = store.exists(slug);
      await store.createHackathon(slug);
      await activate(slug);
      await send(
        existed
          ? `**${slug}** already exists, switched to it (${STAGE_LABEL[store.stageOf(slug)]}).`
          : `Started **${slug}**. Files go to ideas/${slug}/. Paste the track brief.`,
      );
      if (!inlineBrief && earlierBrief) await handleText(earlierBrief);
    });
    // Queue the inline brief now, so the rest of a long paste (Telegram splits it) merges after it in order.
    if (inlineBrief) enqueueText(inlineBrief);
  });

  bot.command(['open', 'resume'], (ctx) => {
    flushPending();
    serial(async () => {
      const slug = store.slugify(ctx.match);
      if (!slug || !store.exists(slug)) return send(`No saved hackathon "${ctx.match}". /list shows them.`);
      await activate(slug);
      const preview = store.summaryPreview(slug);
      await send(`Switched to **${slug}** (${STAGE_LABEL[store.stageOf(slug)]}).${preview ? `\n\nWhere we left off:\n${preview}` : ''}`);
    });
  });

  bot.command('list', () => {
    const all = store.listHackathons();
    return send(
      all.length
        ? all.map((s) => `${s === active ? '▶' : '•'} **${s}**: ${STAGE_LABEL[store.stageOf(s)]}`).join('\n')
        : 'No hackathons yet. Start one with /new <name>.',
    );
  });

  bot.command('status', () => {
    if (!active) return send('No hackathon is active. /new <name> or /open <name>.');
    const files = store.listFiles(active);
    return send(
      `**${active}**: ${STAGE_LABEL[store.stageOf(active)]}\nFiles: ${files.map((f) => `ideas/${active}/${f}`).join(', ') || 'none yet'}\nModel: ${cfg.model}`,
    );
  });

  bot.command('stop', () => {
    flushPending();
    serial(async () => {
      if (!active) return send('Nothing is active.');
      const slug = active;
      if (store.stageOf(slug) !== 'awaiting-brief') {
        await agentTurn(
          slug,
          `I'm stopping for now. Make sure ${store.FILES.discussion} is fully up to date (decisions, chosen idea, open questions, next steps), then reply with a wrap-up of three lines at most.`,
        );
      }
      await activate(null);
      await send(`Stopped **${slug}**. Everything is in ideas/${slug}/. /open ${slug} picks it back up.`);
    });
  });

  bot.command('cancel', async () => {
    pending = [];
    clearTimeout(debounce);
    abortRunning();
    await note('Cancelled.');
  });

  bot.command('skills', () => send(formatReport(checkSkills())));

  bot.on('message:text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return send('Unknown command. /help lists them.');
    enqueueText(ctx.message.text);
  });

  bot.catch((err) => console.error('[telegram] handler error', err.error));

  await bot.api.setMyCommands([
    { command: 'new', description: 'Start a hackathon: /new <name>' },
    { command: 'open', description: 'Switch to a saved hackathon' },
    { command: 'list', description: 'Saved hackathons' },
    { command: 'status', description: 'Current hackathon and files' },
    { command: 'stop', description: 'Wrap up and save the summary' },
    { command: 'cancel', description: 'Stop the reply in progress' },
    { command: 'skills', description: 'Skill dependency check' },
    { command: 'help', description: 'How this works' },
  ]);

  const greeting = [
    active
      ? `🟢 Back online. Resuming **${active}** (${STAGE_LABEL[store.stageOf(active)]}).`
      : '🟢 Online. Start a hackathon with /new <name>.',
  ];
  const preview = active ? store.summaryPreview(active) : '';
  if (preview) greeting.push('', 'Where we left off:', preview);
  if (report.unresolved.length) {
    greeting.push('', `Skill check: ${report.unresolved.map((u) => `${u.skill} is missing ${u.missing.join(', ')}`).join('; ')}.`);
  }
  await send(greeting.join('\n')).catch((err) =>
    console.warn(`[telegram] could not message you (send /start to the bot first): ${err instanceof Error ? err.message : err}`),
  );

  const shutdown = () => {
    console.log('Shutting down…');
    abortRunning();
    void bot.stop();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await bot.start({
    onStart: (me) => console.log(`@${me.username} is running. Active hackathon: ${active ?? 'none'}`),
  });
}

main().catch((err) => {
  console.error(`Startup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
