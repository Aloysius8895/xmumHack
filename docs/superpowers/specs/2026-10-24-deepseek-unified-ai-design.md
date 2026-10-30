# Unified DeepSeek API integration — proposed design

Date: 2026-10-24 (Asia/Kuala_Lumpur)
Status: Approved by the user on 2026-10-24; implemented locally and verified.

## Objective

Route every existing model-backed CareerSphere feature, including features reached through n8n, to the user's existing official DeepSeek API key. Keep credentials on the server and preserve the SDG merge, existing game rules, storage, deduplication and supported conversation behavior.

## Current findings

- Current branch: `database-model`, after SDG merge commit `bf052c0`.
- `src/game/.env` contains a nonempty `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL=deepseek-flash`, but `AI_PROVIDER` is empty. No key value was printed during inspection.
- Game provider selection currently supports `bedrock`, `deepseek_direct`, `replit` and `anthropic`. `deepseek_direct` means AWS Lambda, rather than local direct API access.
- Game structured features call `server/ai.js:ask`; mentor and industry expert conversations call `reply`.
- Chatbot `app/ai.py` supports AWS providers, Anthropic and OpenAI, with no local `deepseek` provider.
- Telegram n8n workflow forwards to the existing chatbot, which classifies messages, records learning through the game API, and sends replies.
- Market n8n workflow currently extracts job skills and aggregates demand using deterministic code. It has no model node or model request.
- n8n daily digest requests `summary_only=true`: it quotes accepted reports and sends no mastery deltas. The separate standard chatbot digest uses AI drafting through `ai.complete`.

## Approaches

1. **Recommended: direct DeepSeek provider in both services.** Use the official Anthropic-compatible endpoint with the already installed Anthropic SDKs. Share the same key value through ignored local configuration or deployment secrets. This works without provisioning AWS and preserves game streaming and tool-based structured output.
2. **AWS gateway for every AI request.** Use the existing `deepseek_direct` Lambda provider and Secrets Manager. Requires a deployed AWS backend and account configuration; the current gateway accepts text only and returns completed answers instead of token streaming.
3. **Change only Anthropic environment variables.** Point the old Anthropic configuration to DeepSeek. This is insufficient because Claude-specific structured-output options are unsupported and provider/model status would be misleading.

## Recommended configuration

- Introduce the explicit local provider name `deepseek` in both services.
- Set local service configuration to `AI_PROVIDER=deepseek` and `DEEPSEEK_MODEL=deepseek-flash`.
- Use only `DEEPSEEK_API_KEY` for this provider and the official `https://api.deepseek.com/anthropic` endpoint. Do not use Claude, OpenAI or Replit credentials when DeepSeek is selected.
- Reuse the existing key in the chatbot's ignored `.env`. Preserve any existing chatbot configuration and never overwrite unrelated secrets. Do not put keys into workflow JSON, frontend variables, tracked examples, logs or documentation.
- Ensure the chatbot loads its `.env` before reading provider configuration; add explicit environment loading if the current entry point does not do so.
- Leave existing AWS data persistence and explicitly selected alternate providers available. Selecting DeepSeek changes model routing, not database routing.
- Update `.env.example` and deployment instructions with empty key placeholders and the same provider/model names.

## Feature coverage

| Feature | DeepSeek route |
| --- | --- |
| Skill profile extraction from text, supported images and CVs | Game `ask` |
| Job requirement analysis and skill generation | Game `ask` |
| New careers, including SDG target selection | Game `ask` |
| Three-language roadmaps | Game `ask` |
| Learning-log classification and task matching | Game `ask` |
| Mentor and distilled expert conversations | Game `reply`, retaining streaming and cancellation |
| Chatbot message classification | Chatbot `complete` |
| Chatbot casual conversation | Chatbot `reply` |
| Standard AI-drafted daily digest | Chatbot `complete`, retaining skill and delta validation |
| n8n Telegram workflow | Existing chatbot/game routes above |
| n8n summary-only digest | Preserve extractive summary; no model request is required |
| n8n recruitment statistics | Preserve deterministic skill extraction and arithmetic; no model request exists |

Adding a new AI recruitment summarizer or replacing summary-only digests with generated summaries is outside this provider migration.

## Input and output compatibility

- Reuse the game's tool submission path for DeepSeek structured results, with local schema validation and one correction attempt. Do not send Claude-only `output_config.format`, fallback options or Replit-only strict flags to DeepSeek.
- Keep streamed text, conversation history and AbortSignal handling for mentors and experts.
- Pass supported JPEG, PNG, GIF and WebP image blocks to `deepseek-flash`.
- DeepSeek's Anthropic-compatible API does not support `document` blocks. Add server-side text extraction for text-bearing PDF uploads before sending text to DeepSeek; keep file size limits and bounded extracted text. Image-only PDFs receive a clear request to upload page images or usable text, rather than silently switching providers or pretending the PDF was read.
- Use clear existing error categories for missing key, authentication, rate limit, network failure, invalid structured results and unsupported documents.
- Keep mock/demo behavior explicit. Verify the normal configured runtime reports DeepSeek and has mock mode disabled.

## Workflow updates

- Update generated workflow notes and n8n documentation to explain which backend performs DeepSeek calls and where its key is configured.
- Rebuild workflow JSON from its source builders; do not hand-edit generated code or embed credentials.
- Preserve owner filtering, Telegram webhook authentication, retries, message IDs, summary-only behavior and scheduling.
- Do not activate external workflows, send chat messages, provision AWS resources, push commits or deploy services as part of local integration.

## Validation

- Mock DeepSeek HTTP requests to verify provider selection, exclusive key use, official endpoint, model, structured correction, error handling, images, PDF conversion and streaming/cancellation.
- Test chatbot classification, conversation and standard digest routing with DeepSeek selected and other provider credentials also present.
- Run game backend tests, chatbot tests, n8n pipeline/integration tests, workflow rebuild and production build.
- If the existing key and outbound access permit, make a minimal real request containing synthetic text to verify authentication and provider/model selection. Do not use personal files or send Telegram/WhatsApp messages for this check.
- Report separately what was verified locally, what was verified against the live API, and what still requires importing workflows or setting deployment secrets on another machine.

## References checked

- https://api-docs.deepseek.com/ — official model identifiers and endpoint configuration.
- https://api-docs.deepseek.com/guides/anthropic_api/ — streaming, tools, image support and unsupported document blocks.
- https://api-docs.deepseek.com/guides/vision/ — `deepseek-flash` image support.
- https://api-docs.deepseek.com/guides/json_mode/ — JSON formatting limitations.

## Approval and verification

The user approved the direct-provider design, PDF text extraction and deterministic workflow behavior on 2026-10-24. Game structured output and streaming, and a chatbot utility call, passed live against the official DeepSeek API using synthetic text. Both local services use deepseek-flash. Existing n8n workflows must be re-imported and deployed services restarted/configured separately.
