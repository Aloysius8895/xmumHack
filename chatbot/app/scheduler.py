"""In-process daily digest scheduler: runs app.digest.run() once a day at 23:30
Asia/Kuala_Lumpur, while DIGEST_SCHEDULE_ENABLED=true and this process stays up.

Replit Autoscale deployments sleep when idle, so this can silently stop firing;
see the README for the Reserved VM / external cron alternative.
"""
import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import Optional

from . import digest
from .db import MYT

log = logging.getLogger("whatsapp")

RUN_AT = time(23, 30)


def _seconds_until_next_run(now: Optional[datetime] = None) -> float:
    now = now or datetime.now(MYT)
    target = now.replace(hour=RUN_AT.hour, minute=RUN_AT.minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


async def _loop() -> None:
    while True:
        await asyncio.sleep(_seconds_until_next_run())
        try:
            await asyncio.to_thread(digest.run)
        except Exception:
            log.exception("scheduled digest run failed")


def start() -> asyncio.Task:
    return asyncio.create_task(_loop())
