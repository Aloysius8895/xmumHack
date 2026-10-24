# Development skill cleanup

Removed the seven development-reference categories from the project root: `3D_model`, `Copy`, `data`, `Distillation`, `game`, `idea`, and `rendering`. Their original combined directory size was approximately 5.7 GiB, including local dependencies and Git metadata. Runtime code, build configuration, Python tools, manifests, and workflows had no file-loading dependency on these libraries; remaining source comments and historical plans describe development provenance only.

All seven associated Git submodule registrations and `.gitmodules` were removed. The root `/skills/` path is ignored to prevent development reference libraries being accidentally shipped again. Existing beginner-tour work is retained separately and unchanged by cleanup.

Preserved application dependencies include:

- `GamePlat/expert/`: the live AI mentor persona cards, full source skills, research, and licenses. `server/experts.js` reads the local `card.md` files from this directory.
- The actual career skill catalog, extracted-skill translations, game assets, Blender tools, collection adapters, market data, workflows, environment files, and player saves.
- User-wide Codex/agent skill installations outside this repository.

Recovery copies remain local and outside the project:

- `C:\maven\GameEmployee-unused-skills-backup-20261025-015332.zip`: 349 files from the two previously untracked skill libraries; the archive integrity check passed.
- `C:\maven\GameEmployee-unused-skills-20261025-015332`: remaining local reference files and caches moved outside the project after tracked files were removed through Git.
- Tracked references remain recoverable from Git history; Git retained submodule repositories in its own metadata. A partial archive attempt also left 38 duplicate metadata files in `C:\maven\GameEmployee-unused-skills-archive-20261025-015332`.

The finished project no longer contains a root `skills/` directory. Cleanup is reversible; the original 5.7 GiB figure is not a claim of physical disk space reclaimed.

Validation after removal:

- 159 game/server/career/n8n tests passed.
- 53 collection-service tests passed.
- Eight data-processing tests and 22 offline integrity/replay checks passed; no network collection was run.
- Both active AI mentor persona cards loaded from `GamePlat/expert/`.
- The production Vite build passed, with its existing bundle/dependency warnings.
- No root skill directory, tracked skill paths, `.gitmodules`, or local skill submodule registrations remain. The existing expert files and game environment file have no cleanup changes.
