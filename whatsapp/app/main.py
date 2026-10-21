"""CareerSphere WhatsApp chat (FastAPI): WhatsApp <-> Replit AI.

  GET  /whatsapp/webhook   Meta's verification handshake
  POST /whatsapp/webhook   incoming WhatsApp messages
  GET  /health             status, and which AI provider/model is active
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from . import ai, db, handlers
from . import whatsapp_api as wa
from .config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("whatsapp")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    log.info("Ready: dry_run=%s, ai=%s/%s", get_settings().dry_run, ai.provider(), ai.model_name())
    yield


app = FastAPI(title="CareerSphere WhatsApp chat", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "dry_run": get_settings().dry_run, "ai_provider": ai.provider(), "ai_model": ai.model_name()}


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
    background.add_task(handlers.handle_payload, await request.json())
    return {"status": "received"}
