---
name: track-decoder
description: Decodes a pasted hackathon track brief (sponsor blurb, rules, prizes, judging criteria) into a track card - the real ask, hard requirements, judging weights and sponsor angle. Use whenever the user pastes a hackathon track or challenge description, asks "what does this track actually want", or before brainstorming ideas for a hackathon track.
---

# Track Decoder

A hackathon brief is part marketing, part rules and part wish list. Your job is to separate them so later ideation targets what judges will actually reward instead of what the copy sounds like.

## Input

The raw brief text as pasted. It may be messy: several tracks in one paste, prize tables, sponsor boilerplate, FAQ fragments. If it holds more than one track, produce one card per track.

Do not invent facts. Everything on the card is either **stated** (quote or near-quote the brief) or **inferred** (mark it `(inferred)` and say from what). Unknowns go under Open questions, not into the other sections.

## How to decode

1. **Strip the marketing.** Rewrite the sponsor's pitch as one plain sentence: "Build X for Y, using Z, and show W." If you can't fill a slot, leave it as `?` and add an open question.
2. **Find the real ask.** What would make a judge from this sponsor say "this is exactly what we hoped for"? Look at which product, API or behaviour the sponsor wants to show off, the example ideas they list (these mark the expected centre, so the winning entry is usually adjacent to them rather than a copy), and the words they repeat.
3. **Pull out the hard requirements.** These are pass/fail checks, not preferences: required tech, APIs or SDKs, submission artifacts (repo, video, deployed URL, slides), eligibility, team size, deadlines, licensing, and anything phrased "must", "required" or "only". A missed one disqualifies the entry, so each requirement gets its source quote.
4. **Set the judging weights.** Use the stated criteria and percentages. If criteria are listed without weights, split 100% evenly and mark it `(inferred)`. If there are no criteria at all, infer them from the brief's emphasis (typically impact, technical execution, use of sponsor tech, creativity, presentation), mark every weight `(inferred)` and give a one-line reason. Weights must add up to 100.
5. **Read the sponsor angle.** Why is this sponsor paying for the track: adoption of a new API, a showcase case study, recruiting, community growth, or feedback on a beta? What should the demo make them want to post about? Note anything the sponsor would not want, such as competitor dependencies or use cases that clash with their brand.
6. **Derive implications.** Convert all of the above into three to six constraints or levers for brainstorming ("must run on their testnet", "a 2-minute video is judged, so the demo moment matters more than breadth").

## Output: the track card

Use exactly this structure. The headings are what later steps parse, so keep them verbatim:

```markdown
## Track: <track name> — <sponsor>

**The real ask:** <one or two sentences, plain language>

### Hard requirements
- [ ] <requirement> — "<source quote>"
- [ ] ...

### Judging weights
| Criterion | Weight | Source |
|---|---|---|
| <criterion> | <n>% | stated / (inferred: <why>) |

### Sponsor angle
- **Why they sponsor:** <...>
- **What makes them post about you:** <...>
- **Avoid:** <...>

### Prizes & logistics
<prize amounts, deadline, submission format: whatever the brief states, else "not stated">

### Implications for ideas
- <constraint or lever>

### Open questions
- <question to ask organizers or the sponsor; "none" if none>
```

## Quality checks before you hand it over

- Every hard requirement has a source quote. If you can't quote it, it's a preference or an inference, so move it.
- The weights total 100%, and every inferred weight says why.
- "The real ask" doesn't reuse the sponsor's marketing adjectives (revolutionary, seamless, next-generation and so on).
- Nothing on the card is absent from the brief unless it is marked `(inferred)`.
