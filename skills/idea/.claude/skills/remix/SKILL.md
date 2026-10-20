---
name: remix
description: >-
  Explode an existing or partially-built idea into dozens of wild, cross-domain
  reshapes, then audit and converge to the strongest few. A divergent ideation
  engine that fans out parallel agents across a near→absurd "distance dial"
  (games, biology, finance, crime, art, mythology — anything) and forces each to
  break the idea's own assumptions. Use this whenever the user wants RADICAL new
  features, to reshape / reinvent / rethink a project they already have, to
  cross-pollinate ideas from far-off fields, to "think outside the box", to
  escape safe incremental thinking, to find a bold new angle, or to dream up
  unconventional directions for something already built — even if they don't say
  "remix". Trigger on phrasings like "how could I reinvent…", "wild ideas
  for…", "what would make X totally different", "I'm stuck, give me fresh angles
  on…", "remix my app", "make this stand out". remix is for OPENING an idea up
  and multiplying possibilities — widening the field of options, not narrowing
  toward a single chosen answer.
---

# Remix — Creative Reshape Engine

Take an idea that already exists (a repo, a doc, or a one-paragraph brief) and **explode** it: fan out blind parallel agents that each steal a mechanic from a distant domain and use it to break one of the idea's unspoken assumptions. Then **audit** the spread without crushing the bold ideas, and **converge** to a handful of fully-developed concepts.

The engine fights the default failure mode of any AI ideation session — quietly regressing to safe, on-scope, incremental suggestions. Every explorer is contractually forbidden from bolting features on; it must remove or replace something and name exactly what it stole.

## When to use / when not

**Use it** when the user has *something* already and wants to make it dramatically different or better: new angles, wild features, a reinvention, a way to stand out, an escape from a rut.

**Don't use it** for ideating from a blank page (there's nothing to reshape yet — talk the idea out first), or for narrowing ONE chosen idea down into a finished spec. remix produces strong divergent *directions* — carrying the winner forward is your next step.

## How it runs

This skill orchestrates a background workflow (`remix.workflow.js`) that runs five phases: **Understand → Scout → Explode → Audit → Converge**. It always fans out parallel agents — that breadth is the point.

### 1. Gather inputs (ask only for what's missing)

- **source** *(required)* — a repo path, a doc path, or a pasted description of the idea.
- **wildness** *(default `bold`)* — `grounded` (shippable, breaks one assumption) · `bold` (full range, breaks core assumptions) · `unhinged` (absurd-weighted, all sacred cows fair game, feasibility ignored). Offer the dial if the user hasn't signalled one.
- **focus** *(default `anything`)* — narrow the reshaping if they want: `features`, `monetization`, `growth`, `UX`, `brand`, etc.
- **budget** *(optional)* — if the user set a token target this run, pass it; it scales the explorer fleet.

### 2. Confirm before firing — required guardrail 🛑

remix is expensive: one run fans out ~15-30 parallel agents and can spend roughly **400-600k tokens**. **Never launch the workflow without an explicit go from the user** — especially when this skill *auto-triggered* (the user asked to "reshape" or "remix" something but did not ask you to spend a fortune on agents).

Show this warning and wait:

> ⚠️ **remix is about to fan out ~15-30 parallel agents (≈400-600k tokens) to explode this idea.**
> - **source:** `<repo / doc / brief>`
> - **wildness:** `<grounded | bold | unhinged>`
> - **focus:** `<focus>`
>
> Reply **`go`** to launch, or tell me what to change first.

Proceed only on a clear yes ("go", "fire it", "yes"). If the user hesitates or goes quiet, run nothing. Where the harness supports it, ask this as a yes/no confirmation prompt rather than free text.

### 3. Read the palette, then launch

Read the sibling file `lenses.md` (its text must be passed in — the workflow script can't read files itself), then start the workflow:

```
Workflow({
  scriptPath: "<absolute path to remix.workflow.js next to this SKILL.md>",
  args: { source, wildness, focus, lenses: "<full text of lenses.md>" }
})
```

(The script parses `args` itself — this harness delivers it as a JSON string, which the workflow handles at its boundary. Just pass the object as shown.)

The workflow returns:
```
{ grounding, ideas, finalists, counts }
```
- `grounding` — the extracted core, assumptions, sacred cows, constraints.
- `ideas` — every distinct reshape, each with `scores` and a `bucket` (`safe` / `big-swing` / `sleeper`). This is the full board.
- `finalists` — 3-5 fleshed concept cards, each carrying a `skeptic` and `champion` argument.
- `counts` — how many were explored / survived dedup / advanced.

If the workflow returns `{ error }`, tell the user plainly what failed — don't paper over it:
- `understand-failed` / `scout-failed` — retry, or switch to a pasted brief.
- `cluster-failed` (carries `grounding` + `reshapes`) — usually a mid-run rate/session limit. Don't waste the work: finish **cluster → audit → converge inline** from the returned `reshapes` (dedupe, score on the anchored rubric, bucket, pick a 3-5 spread, add a skeptic/champion each), then write the board as normal.

### 4. Write the board

Stamp today's date yourself (the script can't) and write `creative-board-<YYYY-MM-DD>.md` in the working directory:

1. **Header** — the idea's one-line, a short grounding summary (core + the sacred cows being challenged), the wildness used, and the counts.
2. **Full board** — every idea grouped under its bucket (🔒 safe · 🎲 big swing · 😴 sleeper), one line each: `title — sketch  ·  novelty/fit/feas/moat`. Nothing is thrown away.
3. **Concept cards** — for each finalist, use exactly this template:

```
## <title>            [<bucket emoji> <bucket>]   novelty N · fit N · feas N · moat N
What it is:        <2-4 sentences>
Rule it breaks:    <the assumption / sacred cow>
Kills / replaces:  <the delta — what's removed, not just added>
Stolen from:       <domain> × <technique>
⚔ Skeptic:         <why it dies — the verdict line>
🏆 Champion:        <why it wins — the verdict line>
First move:        <one concrete next step>
```

Then print a tight summary in chat: the counts, and the finalist titles with their buckets.

### 5. Close the loop

End by inviting the user to take a direction further:

> "Want to push one of these further? Tell me which finalist and I'll help you develop it — pressure-test it, sketch the first build, or map out next steps."

Then work the chosen concept with the user directly. remix's job is to widen the field and hand back strong, well-argued directions — developing the winner from there is an ordinary conversation, no extra tooling required.

## The anti-convergence contract (why this works)

These rules live in the workflow's `RULES` constant and bind every explorer. They are the mechanism, not decoration — keep them if you edit the skill:

1. **Break ≥1 named sacred cow.** A bolt-on isn't a reshape.
2. **Name the transfer** — "stole `<mechanic>` from `<domain>`", or the idea is invalid.
3. **Blind explorers** — separate agents, so no groupthink and real diversity.
4. **Banned words** flag lazy ideas (seamless, leverage, synergy, AI-powered, streamline, robust, holistic).
5. **Distance quota** — a minimum of far/absurd lanes, so the spread can't collapse to near-only.
6. **State the delta** — what it removes/replaces, not only what it adds. The cheapest test of a real reshape.

The audit protects boldness on purpose: ideas land in **portfolio buckets** rather than one ranking, and the finalist pick is forced to include at least one big-swing and one sleeper — so the wild ideas can't be quietly filtered out by feasibility.

## If the harness has no Workflow tool

Remix is built around parallel orchestration. With no `Workflow` tool, run the five phases inline in one context, sequentially: extract grounding → pick ~10 domain×technique lanes across the distance dial → generate reshapes under the contract above → cluster, score on the anchored rubric, bucket → pick a spread of 3-5 → flesh them with a skeptic and champion each → write the same board. Breadth and independence suffer, but the structure and the contract still produce a usable board.
