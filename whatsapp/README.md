# CareerSphere · WhatsApp chat (Replit AI)

Users chat with the CareerSphere companion on WhatsApp. Messages arrive at this
service, the AI (via **Replit AI Integrations**) writes the reply, and the reply
is sent back through the **official WhatsApp Cloud API**.

```
WhatsApp user ──► Meta ──► POST /whatsapp/webhook (this service, deployed on Replit)
                                   │  conversation history (last 20 messages per number)
                                   ▼
                            Replit AI Integrations (Claude or GPT)
                                   │
WhatsApp user ◄── Meta ◄── WhatsApp Cloud API: send reply
```

This is the **first version**: chat only. Linking to the CareerSphere app
(the user's career, roadmap, progress) comes next.

## What it does

- Verifies Meta's webhook (handshake + `X-Hub-Signature-256` signature).
- Remembers each number's conversation so the AI can follow up.
- Ignores duplicate deliveries from Meta.
- `重新开始` / `reset` clears the conversation.
- Non-text messages get a polite "text only" reply; if the AI fails, a fallback message is sent.
- AI instructions: short WhatsApp-style replies in the user's language, support the user's own decisions, never invent jobs, courses or statistics (competition rule).

## AI disclosure

The AI runs through Replit AI Integrations. Default model: `claude-haiku-4-5`
(Anthropic) or `gpt-5-mini` (OpenAI), whichever integration is enabled.
Change it with `AI_MODEL`. `GET /health` shows the provider and model in use.

## Setup

### 1. Meta (WhatsApp Cloud API)
1. developers.facebook.com → create an app → add **WhatsApp**. Meta creates a test number.
2. **API Setup**: add up to 5 recipient phone numbers and verify them.
3. Copy the **Phone Number ID** and the access token. The API Setup token expires after 24 hours; before the demo, use a **System User** token.
4. App settings → Basic → copy the **App Secret**.

### 2. Replit
1. Import `github.com/Aloysius8895/xmumHack`, switch to branch `Whatsapp---Replit-AI`. The root `.replit` runs this folder only.
2. Ask Replit Agent to enable **AI Integrations** (Anthropic or OpenAI) and approve. Replit adds the `AI_INTEGRATIONS_*` variables itself.
3. Add **Secrets**: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (see `.env.example`).
4. **Deploy**. Use the deployment URL, not the editor preview, so the webhook stays online.

### 3. Connect the webhook
Meta app → WhatsApp → Configuration → Webhook:
- Callback URL: `https://<your-deployment>/whatsapp/webhook` (no trailing slash)
- Verify token: same as `WHATSAPP_VERIFY_TOKEN` → **Verify and save**
- Subscribe to **messages**

Send a WhatsApp message from a verified phone to the test number.

## Local run and tests

```bash
cd whatsapp
pip install -r requirements.txt
python run.py          # http://localhost:8000/health
python -m pytest -q    # simulated Meta webhooks, AI mocked
```

Without `WHATSAPP_TOKEN` the service runs in dry run: nothing is sent to WhatsApp.

## Data

Demo only with teammates' test phones and made-up conversations (competition
rule: no real personal data). Chat history is stored in a local SQLite file
(`whatsapp/data/chat.db`, git-ignored).

## Limits

| Limit | Handling |
|---|---|
| Test number reaches only 5 verified recipients | Demo on teammates' phones |
| API Setup token expires in 24h | Use a System User token |
| Replies are free only within 24h of the user's last message | It's a chat: the user writes first |
| AI usage costs Replit credits | Short replies, last 20 messages only |
