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

from . import ai, career_api, db

log = logging.getLogger("whatsapp")

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


def run(date: Optional[str] = None) -> Optional[dict]:
    """Builds and sends the digest for `date` (YYYY-MM-DD, MYT; default today).
    Returns the CareerSphere API response, or None if there was nothing to report."""
    date = date or db.today_myt()
    reports = db.reports_for_date(date)
    if not reports:
        log.info("digest %s: no reports, skipping", date)
        return None

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
