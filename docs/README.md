# Project documentation

| Location | Purpose |
| --- | --- |
| [Main README](../README.md) | Project overview, team details, architecture and current run commands |
| [Replit guide](replit.md) | Development and deployment entry points |
| [Architecture](architecture.md) | Runtime services, data paths and provider boundaries |
| [Submission layout](submission-layout.md) | Template mapping, relocated files and verification notes |
| [Render deployment](render-deployment.md) | Separate game/chatbot services, fixed webhook and storage choices |
| [Development records](superpowers/) | Earlier implementation specifications and plans |
| [Reference archive](reference/) | Upstream site mirror, source capture and research evidence |
| [Verification evidence](verification/) | Existing screenshots and recorded checks |
| [Presentation reviews](reviews/) | Submission and presentation consistency checks |
| [Technical stack](technical-stack-and-diagram-prompt.md) | Supporting technical explanation |
| [Directory migration plan](superpowers/plans/2026-10-25-project-layout.md) | Scope and verification for the repository reorganisation |
| [RunPod guide](../runpod/README.md) | Inference endpoint configuration |
| [Tests](../tests/README.md) | Automated test categories and commands |
| [Submission documents](../submission/) | Competition forms and evidence |

Runtime datasets are split between root `data/` and `src/data/` to preserve their
existing loading paths. Application code stays in `src/`, while documentation,
reference snapshots and visual evidence stay here. Historical evidence is retained
as recorded; moving it is not a new verification run. Private `.env`, player saves
and chatbot databases are excluded from version control.
