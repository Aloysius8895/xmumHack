# Project documentation

| Location | Purpose |
| --- | --- |
| [Main README](../README.md) | Project overview, team details, architecture and current run commands |
| [Replit guide](replit.md) | Development and deployment entry points |
| [Development records](development/) | Earlier implementation notes and upstream game foundation |
| [Technical stack](technical-stack-and-diagram-prompt.md) | Supporting technical explanation |
| [Directory migration plan](superpowers/plans/2026-10-25-project-layout.md) | Scope and verification for the repository reorganisation |
| [RunPod guide](../runpod/README.md) | Inference endpoint configuration |
| [Tests](../tests/README.md) | Automated test categories and commands |
| [Submission documents](../submission/) | Competition forms and evidence |

Runtime datasets remain in `src/data` so the game and sampling service can share their existing relative paths. Historical verification outputs and reference assets also retain their module relationships inside `src`; `docs/development` contains their explanatory records. Local ZIP archives in `docs/archives` are ignored by Git.
