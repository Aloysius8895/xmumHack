import path from 'node:path';
import {
  query,
  type HookCallback,
  type Options,
  type SDKResultMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { AGENT_TOOLS, MAX_TURN_USD, REQUIRED_SKILLS, ROOT, type Config } from './config.js';
import { INSTRUCTIONS, STAGE_HINTS } from './instructions.js';
import { FILES, hackathonDir, listFiles, mtimeMs, stageOf } from './store.js';

export interface TurnEvents {
  onSkill?: (name: string) => Promise<void>;
  onSaved?: (relPath: string) => Promise<void>;
}

// One SDK session per hackathon, for this process only. After a restart the first turn starts a
// fresh session and the agent rebuilds its context from ideas/<slug>/*.md.
const sessions = new Map<string, string>();
let running: AbortController | null = null;

export const forgetSession = (slug: string) => sessions.delete(slug);
export const abortRunning = () => running?.abort();

function agentEnv(cfg: Config): Record<string, string | undefined> {
  // Keep the Telegram token out of the agent, and make the .env API key the only Anthropic credential it sees.
  const { TELEGRAM_BOT_TOKEN: _token, ANTHROPIC_AUTH_TOKEN: _auth, ...env } = process.env;
  return { ...env, ANTHROPIC_API_KEY: cfg.apiKey, CLAUDE_AGENT_SDK_CLIENT_APP: 'hackathon-idea-bot/0.1.0' };
}

function baseOptions(cfg: Config): Options {
  return {
    cwd: ROOT,
    model: cfg.model,
    effort: 'high',
    // Project settings only: skills come from .claude/skills/, nothing from the user's ~/.claude.
    settingSources: ['project'],
    skills: REQUIRED_SKILLS,
    tools: AGENT_TOOLS,
    allowedTools: AGENT_TOOLS.filter((t) => t !== 'Skill'),
    permissionMode: 'dontAsk',
    systemPrompt: { type: 'preset', preset: 'claude_code', append: INSTRUCTIONS },
    env: agentEnv(cfg),
    stderr: (data) => {
      if (process.env.DEBUG_AGENT) process.stderr.write(data);
    },
  };
}

const norm = (p: string) => {
  const abs = path.resolve(ROOT, p);
  return process.platform === 'win32' ? abs.toLowerCase() : abs;
};

const isInside = (child: string, parent: string) => {
  const rel = path.relative(norm(parent), norm(child));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};

/** Returns why a tool call is blocked, or null to let it through. */
export function checkToolUse(tool: string, input: Record<string, unknown>, slug: string): string | null {
  const target = typeof input.file_path === 'string' ? input.file_path : typeof input.path === 'string' ? input.path : '';
  switch (tool) {
    case 'Write':
    case 'Edit':
      return target.toLowerCase().endsWith('.md') && norm(path.dirname(norm(target))) === norm(hackathonDir(slug))
        ? null
        : `Blocked: write only Markdown files directly inside ideas/${slug}/.`;
    case 'Read':
    case 'Glob': {
      const pattern = typeof input.pattern === 'string' ? input.pattern : '';
      if (path.isAbsolute(pattern) || pattern.split(/[\\/]/).includes('..')) return 'Blocked: use a pattern relative to the project.';
      if (!target) return null;
      if (!isInside(target, ROOT)) return 'Blocked: reads are limited to this project folder.';
      if (/^\.env/i.test(path.basename(target)) || isInside(target, path.join(ROOT, 'node_modules'))) {
        return 'Blocked: that file is off limits.';
      }
      return null;
    }
    default:
      return null;
  }
}

function buildPrompt(slug: string, text: string, freshSession: boolean): string {
  const files = listFiles(slug);
  const context = [
    `Active hackathon: ${slug} (folder ideas/${slug}/)`,
    `Saved files: ${files.join(', ') || 'none yet'}`,
    `Stage: ${STAGE_HINTS[stageOf(slug)]}`,
  ];
  if (freshSession && files.length) {
    context.push(
      `This is a new session for an existing hackathon (the bot restarted or switched to it). Before replying, read the saved files, ${FILES.discussion} first, and continue from where it left off.`,
    );
  }
  return `<bot-context>\n${context.join('\n')}\n</bot-context>\n\n${text}`;
}

/** Runs one conversational turn for a hackathon and returns the reply to send to Telegram. */
export async function runTurn(cfg: Config, slug: string, text: string, events: TurnEvents = {}): Promise<string> {
  const startedAt = Date.now();
  const resume = sessions.get(slug);
  let reply: string | undefined;

  const preToolUse: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {};
    const reason = checkToolUse(input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>, slug);
    return reason
      ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }
      : {};
  };

  const postToolUse: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PostToolUse') return {};
    const toolInput = (input.tool_input ?? {}) as Record<string, unknown>;
    if (input.tool_name === 'Skill') {
      await events.onSkill?.(String(toolInput.skill ?? toolInput.command ?? toolInput.name ?? 'unknown'));
    } else if ((input.tool_name === 'Write' || input.tool_name === 'Edit') && typeof toolInput.file_path === 'string') {
      await events.onSaved?.(path.relative(ROOT, path.resolve(ROOT, toolInput.file_path)).replaceAll('\\', '/'));
    }
    return {};
  };

  // Keeps discussion.md (the resume point) current. If the agent ends a turn without updating it, the
  // hook sends it back once to do so; the reply it had already written is kept for Telegram.
  const stop: HookCallback = async (input) => {
    if (input.hook_event_name !== 'Stop' || input.stop_hook_active) return {};
    reply = input.last_assistant_message;
    const summaryStale = stageOf(slug) !== 'awaiting-brief' && mtimeMs(slug, FILES.discussion) < startedAt;
    return summaryStale
      ? {
          decision: 'block',
          reason: `Update ideas/${slug}/${FILES.discussion} for this turn now. Your reply above is already saved for the user, so end the turn without repeating it.`,
        }
      : {};
  };

  running = new AbortController();
  const q = query({
    prompt: buildPrompt(slug, text, !resume),
    options: {
      ...baseOptions(cfg),
      resume,
      abortController: running,
      maxBudgetUsd: MAX_TURN_USD,
      hooks: {
        PreToolUse: [{ hooks: [preToolUse] }],
        PostToolUse: [{ hooks: [postToolUse] }],
        Stop: [{ hooks: [stop] }],
      },
    },
  });

  let result: SDKResultMessage | undefined;
  try {
    for await (const msg of q) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessions.set(slug, msg.session_id);
        console.log(
          `[agent] ${slug}: session ${msg.session_id}${resume ? ' (resumed)' : ''}, key: ${msg.apiKeySource}, skills: ${msg.skills.join(', ')}`,
        );
        if (msg.apiKeySource !== 'ANTHROPIC_API_KEY') {
          console.warn(`[agent] warning: Claude Code is not using ANTHROPIC_API_KEY from .env (source: ${msg.apiKeySource})`);
        }
      } else if (msg.type === 'result') {
        result = msg;
      }
    }
  } finally {
    running = null;
  }

  if (!result) throw new Error('The agent stopped without a result (cancelled?).');
  console.log(`[agent] ${slug}: ${result.subtype}, ${result.num_turns} turns, $${result.total_cost_usd.toFixed(3)}`);

  if (result.subtype !== 'success') {
    if (result.subtype === 'error_max_budget_usd') {
      throw new Error(`Stopped: this reply hit the $${MAX_TURN_USD} per-turn budget cap. Files saved so far are kept.`);
    }
    sessions.delete(slug);
    throw new Error(`The agent failed (${result.subtype}): ${result.errors.join('; ') || 'no details'}`);
  }
  return (reply ?? result.result).trim() || '(no reply)';
}

/**
 * Starts Claude Code without sending a prompt (no model call) and reports which skills it loaded and
 * where its API key comes from. Used at startup so a broken install fails before Telegram connects.
 */
export async function probeAgent(cfg: Config): Promise<{ skills: string[]; apiKeySource?: string; version?: string }> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  async function* noPrompt(): AsyncGenerator<SDKUserMessage> {
    await held;
  }

  const q = query({ prompt: noPrompt(), options: baseOptions(cfg) });
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Claude Code did not start within 60s.')), 60_000);
    });
    const init = await Promise.race([q.initializationResult(), timeout]);
    return {
      skills: init.commands.map((c) => c.name),
      apiKeySource: init.account.apiKeySource,
      version: init.claude_code_version,
    };
  } finally {
    clearTimeout(timer);
    release();
    q.close();
  }
}
