# Submission layout alignment

The README follows the section order of the
[organizer's submission template](https://github.com/michaelzhngg/SDC_Hackathon_Submission_Template/blob/main/README.md).
Its Python filenames are examples; this repository retains the actual Node and
FastAPI entry points and the existing RunPod endpoint adapter.

| Previous path | Current path |
| --- | --- |
| `src/verification/` | `docs/verification/` |
| `src/site/` | `docs/reference/site/` |
| `src/analysis/` | `docs/reference/analysis/` |
| `src/bruno-simon_20261020_093901/` | `docs/reference/bruno-simon_20261020_093901/` |
| `src/asset-manifest.json` | `docs/reference/asset-manifest.json` |
| `src/tools/static-listing.json`, `original-index.html`, `mirror.log` | Corresponding files in `docs/reference/` |
| `src/serve.py`, `src/start.cmd` | `src/tools/serve_reference.py`, `src/tools/start-reference.cmd` |
| `output/reviews/` | `docs/reviews/` |
| `submission/SDC2026_Chill_Chill_Preliminary-2.pdf` | `submission/SDC2026_Chill_Chill_Preliminary.pdf` |
| `submission/SDC2026_Chill_chill_Runpod_POU.pdf` | `submission/SDC2026_Chill_Chill_Runpod_POU.pdf` |

The active game, chatbot, datasets, RunPod adapter and Render service roots retain
their runtime relationships. Root `data/` is an intentional extension to the
template: server modules read it directly. Private environment files, player
saves, chatbot databases and local tooling are not submission documents.

Verification utilities now write to `docs/verification/`. Reference-viewing tools
read `docs/reference/`; the optional mirror server's HTML and WASM delivery was
checked locally. Existing captured evidence is retained rather than presented
as a fresh browser/GPU verification.

During the initial layout alignment, the four PDFs matched their previous SHA-256
digests. The subsequent finalist-document replacement is recorded below.
All 1,303 relocated archive
and evidence files preserve their original Git content, allowing checkout line
endings. The main README and new index documents have been checked for local
link targets, and verification output constants have been checked without
executing their browser actions.

The production build passed. An initial game-suite run had one failure in the
unchanged historical-data cache test after a same-size file edit; its isolated
rerun passed. That test uses modification time and size as a cache signature,
which can collide on rapid Windows writes. No historical-data runtime behavior
was changed for this documentation/layout task.
The subsequent complete game-suite rerun passed all 414 tests.

The initial layout record above predates the team's decision to stop using
Replit and RunPod. Their proof-of-use PDFs have since been removed from the
active submission directory, and the root README now documents Render and
DeepSeek. Only the two current finalist PDFs are listed in the submission index.

Items still requiring team confirmation are recorded as incomplete in the
submission checklist: registered SDG track, final PDF approval/signatures,
and real Telegram owner acceptance checks.

## Finalist document replacement

The old preliminary report is replaced by
`submission/SDC2026_ChillChill_Final Project & Prototype Report.pdf`, and the old
technology declaration is replaced by
`submission/SDC2026_Chill_Chill_TechDeclaration_finalist.pdf`.
These supplied filenames distinguish the final-stage submission from the
earlier preliminary naming shown in the historical mapping table above.

Both replacement PDFs open successfully and match the supplied originals'
SHA-256 digests. Their contents have not been rewritten. README links and the submission index
now reference only the current final-stage documents.
