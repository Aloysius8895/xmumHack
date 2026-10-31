# Learning log progress feedback

**Goal:** Make every saved learning entry show its actual task progress and points, including zero outcomes.

**Design:** Preserve historical `advanced` and `points` as the source of truth. Show each task's saved before/after percentages and their difference in percentage points. For zero matches, display zero progress, zero points, classification verdict and the stored explanation. Snapshot task title, skill and hours for new advances so later roadmap replacement does not erase task context. Do not replay historical logs or invent past progress.

**Implementation:** Update `game.applyLog`, `CareerUI.renderLog`, and Chinese/English/Malay log strings. Keep existing scoring and task matching rules. Verify real advances, unmatched and invalid entries, persisted task context and escaped historical explanations with focused server/UI tests; then run the production build.
