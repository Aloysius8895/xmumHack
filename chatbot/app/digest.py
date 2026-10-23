"""Daily digest agent: turns today's saved learning reports into one
POST /api/integrations/digest call.

Competition rule / safety: the AI only drafts the digest. This module is the
final gate - it drops any skillId the AI invents and clamps every delta, no
matter what the AI proposed.
"""
import json
import logging
import re
from typing import Optional
from datetime import date as calendar_date

from . import ai, career_api, db
from .config import get_settings

log = logging.getLogger("chatbot")

DELTA_MIN, DELTA_MAX = -10, 15

PROMPT = """These are today's learning reports from a CareerSphere user, one per line
as "skillIds: [...] | report: ...":

{lines}

Write a JSON object, ONLY the JSON, no other text:
{{"summary": "one sentence, today's learning in aggregate",
  "skills": [{{"skillId": "<only an id that appears above>", "delta": <integer -10..15>,
              "evidence": "short reason, based only on the reports above"}}]}}

Only include a skill if the reports above show real practice on it today. Never invent
a skillId that isn't in the list above. Be conservative with delta."""


def _parse(raw: str) -> dict:
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError("no JSON object in AI output")
    return json.loads(match.group(0))


def _draft(reports: list[dict]) -> dict:
    lines = "\n".join(f"skillIds: {r['skill_ids']} | report: {r['text']}" for r in reports)
    raw = ai.complete(PROMPT.format(lines=lines))
    return _parse(raw)


def run(date: Optional[str] = None, *, summary_only: bool = False, telegram_user_id: Optional[str] = None) -> Optional[dict]:
    """Builds and sends the digest for `date` (YYYY-MM-DD, MYT; default today).
    Returns the CareerSphere API response, or None if there was nothing to report."""
    date = date or db.today_myt()
    if calendar_date.fromisoformat(date).isoformat() != date:
        raise ValueError("date must be YYYY-MM-DD")
    reports = db.reports_for_date(date)
    if summary_only:
        # This game has one local player: do not merge multiple people's reports.
        if not telegram_user_id or get_settings().allowed_tg_ids != frozenset({telegram_user_id}):
            raise ValueError("summary-only requires the single demo owner's TELEGRAM_ALLOWED_USER_IDS")
        reports = [report for report in reports if report["wa_id"] == f"tg:{telegram_user_id}"]
    if not reports:
        log.info("digest %s: no reports, skipping", date)
        return None

    if summary_only:
        # Extractive summary: original accepted reports only, no generated evidence or skill deltas.
        summary = "用户已提交的学习汇报 / Submitted learning reports:\n" + "\n".join(
            f"- {report['text']}" for report in reports
        )
        return career_api.digest_summary(date, summary[:1000])

    allowed_skill_ids = {sid for r in reports for sid in r["skill_ids"]}

    try:
        draft = _draft(reports)
    except Exception:
        log.exception("digest %s: AI draft failed, skipping", date)
        return None

    seen = set()
    skills = []
    for s in draft.get("skills", []):
        skill_id = s.get("skillId")
        if not isinstance(skill_id, str) or skill_id not in allowed_skill_ids or skill_id in seen:
            continue
        try:
            delta = int(s["delta"])
        except (KeyError, TypeError, ValueError):
            continue
        delta = max(DELTA_MIN, min(DELTA_MAX, delta))
        seen.add(skill_id)
        skills.append({"skillId": skill_id, "delta": delta, "evidence": str(s.get("evidence", ""))[:300]})

    summary = str(draft.get("summary", ""))[:500]
    return career_api.digest(date, summary, skills)
