"""CareerSphere chat bot (FastAPI): WhatsApp/Telegram <-> Replit AI <-> CareerSphere app.

  GET  /whatsapp/webhook      Meta's verification handshake
  POST /whatsapp/webhook      incoming WhatsApp messages
  POST /telegram/webhook      incoming Telegram updates (X-Telegram-Bot-Api-Secret-Token)
  POST /internal/digest/run   manually (re)run the daily digest (X-Cron-Token)
  GET  /health                status, which channels are configured, and the active AI provider/model
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from . import ai, db, digest, scheduler, telegram_channel, whatsapp_channel
from . import whatsapp_api as wa
from .config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx/httpcore log each request at INFO, including the full URL - Telegram's API
# URLs embed the bot token (https://api.telegram.org/bot<token>/...), so keep them quiet.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
log = logging.getLogger("chatbot")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    log.info("Ready: dry_run=%s, ai=%s/%s", get_settings().dry_run, ai.provider(), ai.model_name())
    task = scheduler.start() if get_settings().digest_schedule_enabled else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="CareerSphere WhatsApp chat", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    st = get_settings()
    return {
        "ok": True, "dry_run": st.dry_run, "ai_provider": ai.provider(), "ai_model": ai.model_name(),
        "channels": {
            "whatsapp": bool(st.whatsapp_token and st.phone_number_id and st.app_secret),
            "telegram": bool(st.telegram_bot_token and st.telegram_webhook_secret),
        },
    }


@app.get("/whatsapp/webhook", response_class=PlainTextResponse)
def verify_webhook(
    mode: Optional[str] = Query(default=None, alias="hub.mode"),
    token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
) -> str:
    st = get_settings()
    if mode == "subscribe" and st.verify_token and token == st.verify_token and challenge:
        return challenge
    raise HTTPException(status_code=403, detail="verification failed")


@app.post("/whatsapp/webhook")
async def receive_webhook(request: Request, background: BackgroundTasks) -> dict:
    raw = await request.body()
    if not wa.verify_signature(raw, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(status_code=401, detail="bad signature")
    # Reply 200 to Meta immediately; the AI call happens after the response is sent.
    background.add_task(whatsapp_channel.handle_payload, await request.json())
    return {"status": "received"}


@app.post("/telegram/webhook")
async def telegram_webhook(
    request: Request,
    background: BackgroundTasks,
    x_telegram_bot_api_secret_token: Optional[str] = Header(default=None),
) -> dict:
    st = get_settings()
    if not st.telegram_webhook_secret or x_telegram_bot_api_secret_token != st.telegram_webhook_secret:
        raise HTTPException(status_code=401, detail="bad secret token")
    # Reply 200 to Telegram immediately; processing happens after the response is sent.
    background.add_task(telegram_channel.handle_update, await request.json())
    return {"status": "received"}


@app.post("/internal/digest/run")
def run_digest(x_cron_token: Optional[str] = Header(default=None), date: Optional[str] = None) -> dict:
    st = get_settings()
    if not st.cron_token:
        raise HTTPException(status_code=503, detail="CRON_TOKEN not configured")
    if x_cron_token != st.cron_token:
        raise HTTPException(status_code=401, detail="bad cron token")
    result = digest.run(date)
    return {"ran": result is not None, "result": result}
