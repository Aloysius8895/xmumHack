# RunPod game AI setup

The game supports RunPod as the provider for all existing game AI features through
[`src/game/server/ai.js`](../src/game/server/ai.js): mentors, experts, extraction, roadmaps and learning reports. The adapter is [`provider.js`](provider.js). This
does not change the separate Python chatbot's provider.

1. Deploy a RunPod Serverless vLLM worker with an instruction-following model.
   The worker must support OpenAI-compatible chat completions and
   `response_format: json_schema`. Use a vision-capable model if players upload images.
2. Copy the worker's OpenAI-compatible base URL and its served model name.
3. Set these server-only values in `src/game/.env` or deployment secrets:

```dotenv
AI_PROVIDER=runpod
RUNPOD_BASE_URL=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/openai/v1
RUNPOD_API_KEY=YOUR_PRIVATE_KEY
RUNPOD_MODEL=YOUR_SERVED_MODEL_NAME
RUNPOD_TIMEOUT_MS=240000
AI_MOCK=
```

4. Restart the game server (`npm run dev` for development). Ask a mentor a question,
   then generate a roadmap to verify both text and structured results.

Use the actual URL supplied by your deployment. The adapter appends
`/chat/completions`; `/run` and `/runsync` custom job APIs are not supported by this
adapter. It does not create RunPod resources or deploy an autonomous agent.

Replies are delivered to the existing dialogue UI once the answer completes.
Leaving the dialogue cancels the HTTP request; cancellation does not guarantee
that the remote worker stops computing. Text PDFs are extracted locally using
the existing PDF limits; scanned PDFs need readable text or page images.
Structured responses are validated locally and retried once if invalid. Provider
errors do not switch to DeepSeek or another vendor. Guided demos still use their
existing mock answers. AWS storage can remain configured independently.

Local checks (no RunPod credentials or charges required):

```sh
node --test tests/game/server/runpod.test.mjs tests/game/server/ai-provider.test.mjs tests/game/server/ai-deepseek.test.mjs
```

RunPod endpoint documentation: https://docs.runpod.io/serverless/vllm/overview
