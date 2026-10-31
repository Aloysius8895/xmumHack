# Runtime datasets

The game server loads this directory through existing module-relative paths.
It remains at repository root; `src/data/` separately holds processors, mappings
and historical inputs.

| Directory | Purpose |
| --- | --- |
| `ai-exposure/` | AEI task mappings, measures and comparable-period metadata |
| `official-signals/` | Official occupation and directional reference records |
| `reference/` | Public recruitment reference aggregates |
| `mock/` | Explicitly imputed or simulated values; not observed evidence |
| `crawler/` | Published public recruitment snapshots/window |
| `game/` | Ignored local player save and integration documents |

Player state in `game/` and any configured database credentials must not be
committed. Production persistence depends on the configured backend and is not
provided by keeping public dataset files in Git.
