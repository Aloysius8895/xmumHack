# Source modules

| Directory | Responsibility |
| --- | --- |
| `game/` | Three.js frontend, Node.js game API, AI orchestration and n8n workflow definitions |
| `crawler/` | Recruitment sampling, source adapters, SQLite observations and publication |
| `chatbot/` | FastAPI messaging companion for Telegram and WhatsApp |
| `aws/` | Optional Lambda/API backend and infrastructure templates |
| `data/` | Recruitment parsing, processing, historical evidence and published datasets |
| `expert/` | Persona reference cards used by the AI guidance layer |
| `character/`, `assets/`, `model/` | Editable character and environment source assets |
| `tools/`, `scripts/` | Verification, asset and maintenance utilities |
| `site/`, `analysis/`, `bruno-simon_20261020_093901/` | Retained upstream reference material |
| `verification/` | Existing visual and data verification outputs |

Use the repository-root [README](../README.md) for current commands. Automated Node and Python suites are in [`tests/`](../tests/); source-local fixtures remain with their parsers/workflows. The existing RunPod inference adapter is in [`runpod/provider.js`](../runpod/provider.js).
