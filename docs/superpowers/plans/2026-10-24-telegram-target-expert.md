# Telegram Target Expert Implementation Plan

**Goal:** Implement the user's requested `/expert` introduction and follow-up questions using the target selected in the web game.

**Authorization:** The user requested the command after review of the missing command and existing expert API, and specified target-based selection and an introduction. Proceed inline with that behavior and `/exit` as the return to ordinary chat.

**Architecture:** An authenticated game integration endpoint resolves its saved target and reads the same persona cards as the web game. The chatbot keeps expert mode and bounded history separate from casual chat and learning reports, using SQLite locally and a typed AWS session operation when cloud storage is configured. Existing n8n forwarding already carries commands unchanged.

## Behavior

- `/expert` introduces the target's expert and states that it is an AI perspective distilled from public records. It starts a fresh expert conversation.
- Plain text in expert mode is answered with that persona card through the configured DeepSeek adapter; it does not create learning logs or points.
- The game resolves its current target on every question. A changed target clears old history and introduces the new expert before answering. Missing target or expert returns a helpful message and closes expert mode.
- `/exit`, `/reset` and `/start` leave expert mode. `/reset` keeps its existing ordinary-chat reset behavior.
- Only the single configured `TELEGRAM_ALLOWED_USER_IDS` owner can access the single player's target. Other Telegram users retain normal chat and cannot enter expert mode.
- Preserve direct Telegram and n8n bridge operation, webhook authentication, bounded history and delivery deduplication. Do not send real Telegram messages, activate workflows or deploy AWS.

## Tasks

- [x] Add `GamePlat/game/server/telegram-expert.js` and route `POST /api/integrations/expert`. Validate channel, sender, action, message ID and question; derive target from the loaded save, ignore client target choices, reuse `features.askMentor({ elite: true })`, and cache event responses. Use normal save persistence and cloud idempotency without learning reports.
- [x] Add game integration tests for authentication, intro, actual selected target, history, target switching, missing target/expert, no game progress, and duplicate/replayed deliveries.
- [x] Add chatbot session CRUD in `app/db.py` with a SQLite table and matching typed `/v1/chat/expert-session` operations in Lambda/schema. Keep expert history to six turns and only permit the defined state shape.
- [x] Add `chatbot/app/expert.py` for mode routing, `/expert` and `/exit`; add `career_api.expert` and connect it in `telegram_channel.py`. Reuse the owner binding, keep normal chat unchanged when no expert session exists, and clear pending report confirmations on mode entry/exit.
- [x] Add direct webhook and n8n bridge tests for introduction, follow-ups, resetting/exiting, target changes, unauthorized users, failures, isolation from learning reports and duplicate deliveries. Test cloud session validation/CRUD with database calls mocked.
- [x] Update command help and game/chatbot/n8n/AWS documentation. Run all game, chatbot, n8n and Lambda tests; verify production build and `git diff --check`. Explain deployment/schema requirements and leave external services unchanged.

## Interfaces

Game request: `{channel: 'telegram', from: 'tg:<id>', messageId, action: 'enter'|'ask', text?, careerId?, history?}`. `careerId` identifies the prior session only; the game always chooses the expert from its saved target.

Game response: `{active, reply, careerId?, history?, lang?, expert?}`. Active responses contain the complete next bounded session state. Inactive responses explain an unavailable target/expert.

Chatbot database: `get_expert_session(uid)`, `set_expert_session(uid, state)`, `clear_expert_session(uid)`. Cloud operations GET/PUT/DELETE `/v1/chat/expert-session` share this contract and authenticate through the existing backend token.

## Validation focus

Normal chat must not start depending on game availability. Expert responses must not masquerade as learning evidence, ordinary history, or the real person's identity. Retried updates must reuse the same game response and must not duplicate conversation turns. Existing web expertise and DeepSeek routing remain unchanged.

## Verification results

Game backend regression tests passed, including target-based expert tests; chatbot regression suite: 104 passed; n8n suite: 19 passed; Lambda API/session suites: 18 passed; production build passed. A synthetic end-to-end check ran Telegram command routing, the real game HTTP endpoint, persona-card-based DeepSeek answering and /exit using isolated SQLite/JSON saves. Telegram sends were intercepted and no real messages were sent.

The broader Lambda test run also found two failures in the unchanged legacy exporter tests on Windows: POSIX 0600 mode expectations and SQLite file-lock cleanup. These exporter files were not modified. No cloud deployment, workflow activation or Git push was performed.
