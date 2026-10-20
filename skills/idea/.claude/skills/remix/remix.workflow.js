export const meta = {
  name: 'remix',
  description: 'Explode an existing idea into wild cross-domain reshapes, audit without crushing boldness, converge to the strongest few',
  phases: [
    { title: 'Understand', detail: 'extract core + assumptions + sacred cows' },
    { title: 'Scout', detail: 'assign blind explorers their domain × technique lanes' },
    { title: 'Explode', detail: 'parallel blind reshapes across the distance dial' },
    { title: 'Audit', detail: 'cluster, batch-judge into portfolio buckets, pick finalists' },
    { title: 'Converge', detail: 'skeptic vs champion, flesh finalists into concept cards' },
  ],
}

// ───────────────────────── schemas (bounded → predictable tokens) ─────────────────────────

const GROUNDING_SCHEMA = {
  type: 'object',
  properties: {
    oneLine: { type: 'string', maxLength: 140 },
    core: { type: 'string', maxLength: 220 },
    assumptions: { type: 'array', maxItems: 7, items: { type: 'string', maxLength: 90 } },
    sacredCows: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 90 } },
    constraints: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 90 } },
  },
  required: ['oneLine', 'core', 'assumptions', 'sacredCows', 'constraints'],
}

const ASSIGNMENTS_SCHEMA = {
  type: 'object',
  properties: {
    assignments: {
      type: 'array', maxItems: 24,
      items: {
        type: 'object',
        properties: {
          bucket: { type: 'string', enum: ['near', 'mid', 'far', 'absurd', 'wildcard'] },
          domain: { type: 'string', maxLength: 70 },
          technique: { type: 'string', maxLength: 40 },
          assumptionToBreak: { type: 'string', maxLength: 100 },
        },
        required: ['bucket', 'domain', 'technique', 'assumptionToBreak'],
      },
    },
  },
  required: ['assignments'],
}

const RESHAPES_SCHEMA = {
  type: 'object',
  properties: {
    reshapes: {
      type: 'array', maxItems: 2,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 60 },
          sketch: { type: 'string', maxLength: 220 },   // ≤~25 words
          delta: { type: 'string', maxLength: 130 },    // what it REMOVES/REPLACES
          domain: { type: 'string', maxLength: 70 },
          technique: { type: 'string', maxLength: 40 },
          assumptionBroken: { type: 'string', maxLength: 100 },
          transfer: { type: 'string', minLength: 1, maxLength: 150 },  // "stole X from Y" — required
        },
        required: ['title', 'sketch', 'delta', 'assumptionBroken', 'transfer'],
      },
    },
  },
  required: ['reshapes'],
}

const CLUSTER_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array', maxItems: 40,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 8 },        // stable handle, threads downstream
          title: { type: 'string', maxLength: 60 },
          sketch: { type: 'string', maxLength: 220 },
          delta: { type: 'string', maxLength: 130 },
          domain: { type: 'string', maxLength: 70 },
          technique: { type: 'string', maxLength: 40 },
          assumptionBroken: { type: 'string', maxLength: 100 },
          transfer: { type: 'string', maxLength: 150 },
          mergedFrom: { type: 'integer' },
        },
        required: ['id', 'title', 'sketch', 'delta', 'transfer'],
      },
    },
  },
  required: ['ideas'],
}

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array', maxItems: 14,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 8 },
          novelty: { type: 'integer', minimum: 1, maximum: 5 },
          fit: { type: 'integer', minimum: 1, maximum: 5 },
          feasibility: { type: 'integer', minimum: 1, maximum: 5 },
          moat: { type: 'integer', minimum: 1, maximum: 5 },
          bucket: { type: 'string', enum: ['safe', 'big-swing', 'sleeper'] },
          oneLine: { type: 'string', maxLength: 130 },
        },
        required: ['id', 'novelty', 'fit', 'feasibility', 'moat', 'bucket', 'oneLine'],
      },
    },
  },
  required: ['verdicts'],
}

const FINALISTS_SCHEMA = {
  type: 'object',
  properties: {
    ids: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', maxLength: 8 } },
  },
  required: ['ids'],
}

const ARG_SCHEMA = {
  type: 'object',
  properties: {
    points: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 150 } },
    verdict: { type: 'string', maxLength: 130 },
  },
  required: ['points', 'verdict'],
}

// ───────────────────────── plain helpers (no agents, ~free) ─────────────────────────

const chunk = (arr, n) => arr.reduce((acc, x, i) => ((acc[i % n] ??= []).push(x), acc), [])

const mergeScores = (ideas, verdicts) => {
  const byVid = Object.fromEntries(verdicts.map(v => [v.id, v]))
  return ideas.map(i => ({ ...i, scores: byVid[i.id] ?? null, bucket: byVid[i.id]?.bucket ?? 'sleeper' }))
}

const scoreSum = s => (s ? s.novelty + s.fit + s.feasibility + s.moat : 0)

const topPerBucket = (ideas) =>
  ['safe', 'big-swing', 'sleeper'].flatMap(b =>
    ideas.filter(i => i.bucket === b)
      .sort((a, c) => scoreSum(c.scores) - scoreSum(a.scores))
      .slice(0, 5)
      .map(i => ({ id: i.id, title: i.title, sketch: i.sketch, delta: i.delta, bucket: i.bucket, scores: i.scores })))

const byId = (ideas, id) => ideas.find(i => i.id === id)

// ───────────────────────── prompt builders (the intelligence) ─────────────────────────

const understandPrompt = (source, focus) => `You are the UNDERSTAND phase of a creative reshape engine. Map what an idea REALLY is and — most importantly — name the assumptions it treats as untouchable, so later agents can deliberately break them. You cannot break a rule you have not named.

SOURCE (a repo path, a doc path, or a pasted brief):
${source}

If SOURCE is a repository path: read README / landing copy / entry points / config and skim the structure. Cap yourself at ~15 files — you need the concept and its assumptions, not a full audit. If it is a document, read it. If it is a prose brief, use it directly.

Extract:
- oneLine: what this is, in one breath.
- core: the real job-to-be-done (the outcome users actually want), not the mechanism.
- assumptions: things currently taken for granted about HOW it works — delivery, business model, platform, user behaviour, format. Phrase each as a flat declarative ("users log in", "it is a web app", "you charge monthly"). These are the raw material for breaking, so surface the load-bearing ones.
- sacredCows: the subset of assumptions that feel untouchable — "obviously it has to work this way." The more obvious it feels, the more valuable it is here.
- constraints: real limits a reshape must respect to stay relevant — regulation, hard tech, the actual audience.
${focus !== 'anything' ? `\nThe user wants to focus on: ${focus}. Bias assumptions/sacred cows toward that area, but still capture the core.` : ''}

Be precise and compressed. This map is re-sent to every downstream agent, so every wasted word is paid for many times over.`

const scoutPrompt = (g, wildness, focus, lenses, fleet) => `You are the SCOUT for a creative reshape engine. Assign ${fleet} blind explorer agents their creative lanes. Each lane = one DOMAIN to steal from × one TECHNIQUE to transform with × one ASSUMPTION to break.

THE IDEA:
${JSON.stringify(g, null, 2)}

THE LENS PALETTE (distance buckets, seed domains, technique deck, wildness notes):
${lenses}

Build exactly ${fleet} assignments. Rules:
- COVERAGE: at least one lane in each of near, mid, far, absurd. Plus exactly 2 "wildcard" lanes whose domain is random and unrelated to everything else — surprise yourself.
- DISTANCE WEIGHTING (${wildness}): ${wildness === 'unhinged' ? 'weight HARD toward far/absurd — at least half the lanes there.' : wildness === 'grounded' ? 'weight toward near/mid, but keep at least 2 far/absurd lanes alive.' : 'a balanced spread across all four buckets.'}
- DYNAMIC DOMAINS: pick the spiciest SPECIFIC domain for THIS idea within each bucket (not "games" but "speedrunning route optimization"). Seed lists are a spine, not a cage.
- DISTINCT LANES: no two assignments may be near-duplicate domain×technique pairs, and spread the techniques around — don't put "inversion" on half of them.
- TARGETED BREAKS: for each lane, name a specific assumption or sacred cow from THE IDEA that this lane is positioned to shatter. Aim the wildest domains at the most sacred cows.${focus !== 'anything' ? `\n- FOCUS: bias lanes toward "${focus}", without abandoning coverage.` : ''}`

const explodePrompt = (g, a, wildness, rules) => `You are one BLIND explorer in a creative reshape engine — you cannot see the other explorers. Reshape the idea by stealing from a distant domain, hard enough that it stops being a bolt-on feature and becomes a genuinely different thing.

THE IDEA:
${JSON.stringify(g, null, 2)}

YOUR LANE:
- Steal from DOMAIN: ${a.domain}
- Using TECHNIQUE: ${a.technique}
- Break this assumption: ${a.assumptionToBreak}
- (distance bucket: ${a.bucket})

HOW: Look at how ${a.domain} actually works — its mechanics, incentives, rituals, failure modes. Find one mechanic there that, transplanted, FORCES the idea to violate "${a.assumptionToBreak}". Apply ${a.technique} to make the transplant bite.

THE CONTRACT — a reshape that breaks any of these is invalid; fix it or drop it:
${rules}

WILDNESS = ${wildness}. ${wildness === 'unhinged' ? 'Ignore feasibility entirely. Chase the most disorienting version. If it sounds reasonable, push further.' : wildness === 'grounded' ? 'Stay shippable — a real team could start this quarter — but it must still BREAK the named assumption, not merely decorate it.' : 'Go bold: break the core assumption for real, but keep one thread back to something buildable.'}

Give your STRONGEST 1-2 reshapes only — quality over pile. Be terse: finalists get fully fleshed out later, so here just land the concept (sketch), the transfer ("stole X from ${a.domain}"), and the delta (what it removes/replaces). No preamble.`

const clusterPrompt = (reshapes) => `You are the CLUSTER step of a creative reshape engine. Below are all raw reshapes from many blind explorers; expect duplicates and near-duplicates.

RAW RESHAPES:
${JSON.stringify(reshapes, null, 2)}

Merge near-identical reshapes into single distinct ideas — keep the sharpest title/sketch/delta/transfer of each cluster and set mergedFrom = how many raw reshapes collapsed in. Keep genuinely different ideas separate even when they touch the same domain. Assign each surviving idea a short unique stable id ("i01", "i02", …) — these ids are used downstream.

Do NOT invent new ideas; only dedupe and tidy what is here.`

const judgePrompt = (batch, g, wildness) => `You are a JUDGE in a creative reshape engine. Score each idea below and sort it into a portfolio bucket. You see a batch so you can calibrate them against each other.

THE ORIGINAL IDEA (for fit):
${JSON.stringify(g, null, 2)}

IDEAS TO JUDGE:
${JSON.stringify(batch, null, 2)}

ANCHORED RUBRIC — use the FULL 1-5 range; do NOT bunch everything at 3-4:
- novelty: 5 = "never seen this in this space" · 3 = "fresh combination of known things" · 1 = "obvious / already common".
- fit: 5 = "directly serves the core job-to-be-done" · 3 = "plausibly relevant" · 1 = "off in the weeds".
- feasibility: 5 = "a small team ships a first cut in weeks" · 3 = "hard but doable" · 1 = "needs a breakthrough / years".
- moat: 5 = "very hard to copy or creates real lock-in" · 3 = "some edge" · 1 = "trivially copied".

${wildness === 'unhinged' ? 'WILDNESS unhinged: feasibility is INFORMATION ONLY — never let a low feasibility sink a high-novelty idea.' : wildness === 'grounded' ? 'WILDNESS grounded: feasibility of 1-2 should pull an idea down hard; you want things a team can actually start.' : 'WILDNESS bold: weight novelty and moat over feasibility, but a feasibility of 1 is still a real mark against.'}

Then assign a bucket:
- "safe" = high feasibility AND real lift to the core idea (the dependable wins).
- "big-swing" = high novelty/moat with lower feasibility (the bets).
- "sleeper" = weird or underrated, mid scores but unusually high surprise (dismissed, then stolen).

One verdict per idea, keyed by its id. oneLine = the single sharpest sentence on why it scored that way.`

const finalistPrompt = (leaders, wildness) => `You are the FINALIST PICKER in a creative reshape engine. From the bucket-leading ideas below, choose 3-5 to advance to full development.

CANDIDATES (already scored and bucketed):
${JSON.stringify(leaders, null, 2)}

FORCED SPREAD — the whole point of this engine is to NOT regress to safe:
- Include at least one "big-swing" AND at least one "sleeper". If you pick only safe bets, you have failed.
- Otherwise choose on a blend of novelty, moat, and fit. ${wildness === 'unhinged' ? 'Lean hard into the wildest survivors.' : wildness === 'grounded' ? 'You may favour buildable ones, but still carry one wild card.' : 'Balance a couple of buildable ones against a couple of bold ones.'}
- Prefer a diverse set — don't pick four variations on the same mechanic.

Return 3-5 ids.`

const skepticPrompt = (f, g) => `You are a SKEPTIC. Kill this reshaped idea — find the real reason it fails in the world. Be specific and fair, never lazily dismissive.

ORIGINAL IDEA:
${JSON.stringify(g, null, 2)}

THE RESHAPE:
${JSON.stringify(f, null, 2)}

Give up to 3 sharp points — the real causes of death (adoption, economics, the broken assumption turning out to be load-bearing for a good reason, execution risk). Then a one-line verdict: the single most likely cause of death.`

const championPrompt = (f, g) => `You are a CHAMPION. Make the strongest HONEST case for this reshaped idea — why it could win big. No hype words, just real upside.

ORIGINAL IDEA:
${JSON.stringify(g, null, 2)}

THE RESHAPE:
${JSON.stringify(f, null, 2)}

Give up to 3 sharp points — what it unlocks, who would love it, why the broken assumption was holding the idea back, the moat it builds. Then a one-line verdict: the single most compelling reason to pursue it.`

// ───────────────────────── orchestration ─────────────────────────

// args.lenses = full text of lenses.md, read and passed by the MAIN THREAD
// (workflow scripts have no filesystem access).
// BOUNDARY: this harness delivers `args` as a JSON STRING, not a parsed object —
// parse it here. Tolerate both (string or already-object) so it survives either behaviour.
const A = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
const { source, wildness = 'bold', focus = 'anything', lenses = '' } = A
const FLEET = budget.total
  ? Math.max(6, Math.min(24, Math.floor(budget.total / 80_000)))
  : (wildness === 'unhinged' ? 16 : 12)
// Divergence doesn't need deep reasoning; judgement does. Spend effort where it pays.
const explodeEffort = budget.total && budget.remaining() < 120_000 ? 'low' : 'medium'

// Enforced contract — the anti-convergence rules. Injected into every EXPLODE prompt.
const RULES = `1. break >=1 named sacred cow/assumption; no bolt-ons.
2. name the transfer: "stole <mechanic> from <domain>" — a reshape with no named transfer is invalid.
3. (blindness is structural — you genuinely cannot see the other explorers.)
4. these words flag a lazy idea; rewrite or drop: seamless, leverage, synergy, AI-powered, streamline, robust, holistic.
5. honour the distance of your bucket — a "far"/"absurd" lane must feel far.
6. state the delta: what the reshape REMOVES or REPLACES versus the original, not only what it adds.`

phase('Understand')
const grounding = await agent(understandPrompt(source, focus), { schema: GROUNDING_SCHEMA, effort: 'medium' })
if (!grounding) return { error: 'understand-failed' }

phase('Scout')
const plan = await agent(scoutPrompt(grounding, wildness, focus, lenses, FLEET), { schema: ASSIGNMENTS_SCHEMA, effort: 'medium' })
if (!plan?.assignments?.length) return { error: 'scout-failed', grounding }

phase('Explode')   // blindness = separate agents; terse output
const reshapes = (await parallel(plan.assignments.map(a => () =>
  agent(explodePrompt(grounding, a, wildness, RULES),
    { label: `explode:${a.bucket}:${a.domain}`.slice(0, 60), phase: 'Explode', schema: RESHAPES_SCHEMA, effort: explodeEffort })
))).filter(Boolean).flatMap(r => r.reshapes)
if (!reshapes.length) return { error: 'explode-empty', grounding }

phase('Audit')
const clustered = await agent(clusterPrompt(reshapes), { schema: CLUSTER_SCHEMA, effort: 'medium' })   // barrier: needs all
// Carry the raw reshapes back on failure so the main thread can finish cluster→audit→converge
// inline (e.g. on a mid-run session/rate limit) without digging the journal.
if (!clustered?.ideas?.length) return { error: 'cluster-failed', grounding, reshapes }
if (clustered.ideas.length < 6) log(`thin board: only ${clustered.ideas.length} distinct ideas survived`)
const nBatches = Math.min(3, Math.max(1, Math.ceil(clustered.ideas.length / 6)))   // ~6 ideas/judge, ≤3 judges
const verdicts = (await parallel(chunk(clustered.ideas, nBatches).map((b, i) => () =>
  agent(judgePrompt(b, grounding, wildness), { label: `judge:${i}`, phase: 'Audit', schema: JUDGE_SCHEMA, effort: 'high' })
))).filter(Boolean).flatMap(v => v.verdicts)
const ideas = mergeScores(clustered.ideas, verdicts)
const finalists = await agent(finalistPrompt(topPerBucket(ideas), wildness),
  { label: 'finalist-pick', phase: 'Audit', schema: FINALISTS_SCHEMA, effort: 'high' })

phase('Converge')   // lazy expansion: flesh ONLY finalists
const cards = (await parallel((finalists?.ids ?? []).map(id => byId(ideas, id)).filter(Boolean).map(f => () =>
  parallel([
    () => agent(skepticPrompt(f, grounding), { label: 'skeptic', phase: 'Converge', schema: ARG_SCHEMA, effort: 'high' }),
    () => agent(championPrompt(f, grounding), { label: 'champion', phase: 'Converge', schema: ARG_SCHEMA, effort: 'high' }),
  ]).then(([skeptic, champion]) => ({ ...f, skeptic, champion }))
))).filter(Boolean)

return {
  grounding,
  ideas,                              // all distinct ideas, scored + bucketed → the full board
  finalists: cards,                   // fleshed concept cards (with skeptic/champion)
  counts: { explored: reshapes.length, distinct: clustered.ideas.length, finalists: cards.length },
}
