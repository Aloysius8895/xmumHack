"""Daily digest: builds from today's reports, and is the final safety gate on
skillId and delta even if the AI proposes something else."""
import pytest

from app import ai, career_api, db, digest


@pytest.fixture()
def scratch_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "chat.db"))
    monkeypatch.setenv("CAREERSPHERE_API_URL", "https://careersphere.example")
    monkeypatch.setenv("INTEGRATION_TOKEN", "token")
    db.init_db()


def test_no_reports_skips_and_does_not_call_api(scratch_db, monkeypatch):
    def fail(*a, **kw):
        raise AssertionError("should not call career_api.digest")
    monkeypatch.setattr(career_api, "digest", fail)
    assert digest.run("2026-10-21") is None


def test_filters_unknown_skill_id_and_clamps_delta(scratch_db, monkeypatch):
    db.save_report("60123", "练了 SQL JOIN", "s", ["sql"], [], 50)
    monkeypatch.setattr(ai, "complete", lambda _: (
        '{"summary": "学了 SQL", "skills": ['
        '{"skillId": "sql", "delta": 999, "evidence": "e"}, '
        '{"skillId": "made-up-skill", "delta": 5, "evidence": "e"}]}'
    ))
    captured = {}

    def fake_digest(date, summary, skills):
        captured["date"], captured["summary"], captured["skills"] = date, summary, skills
        return {"digest": {"date": date}}
    monkeypatch.setattr(career_api, "digest", fake_digest)

    result = digest.run(db.today_myt())
    assert result == {"digest": {"date": db.today_myt()}}
    assert captured["skills"] == [{"skillId": "sql", "delta": 15, "evidence": "e"}]


def test_clamps_negative_delta(scratch_db, monkeypatch):
    db.save_report("60123", "x", "s", ["sql"], [], 10)
    monkeypatch.setattr(ai, "complete", lambda _: '{"summary": "s", "skills": [{"skillId": "sql", "delta": -99}]}')
    captured = {}
    monkeypatch.setattr(career_api, "digest", lambda date, summary, skills: captured.setdefault("skills", skills))
    digest.run(db.today_myt())
    assert captured["skills"] == [{"skillId": "sql", "delta": -10, "evidence": ""}]


def test_unparsable_ai_output_skips_without_calling_api(scratch_db, monkeypatch):
    db.save_report("60123", "x", "s", ["sql"], [], 10)
    monkeypatch.setattr(ai, "complete", lambda _: "not json")

    def fail(*a, **kw):
        raise AssertionError("should not call career_api.digest")
    monkeypatch.setattr(career_api, "digest", fail)
    assert digest.run(db.today_myt()) is None


def test_cron_endpoint_rejects_missing_config(client, monkeypatch):
    monkeypatch.delenv("CRON_TOKEN", raising=False)
    r = client.post("/internal/digest/run", headers={"X-Cron-Token": "anything"})
    assert r.status_code == 503


def test_cron_endpoint_rejects_wrong_token(client, monkeypatch):
    monkeypatch.setenv("CRON_TOKEN", "secret-cron")
    r = client.post("/internal/digest/run", headers={"X-Cron-Token": "wrong"})
    assert r.status_code == 401


def test_cron_endpoint_accepts_right_token(client, monkeypatch):
    monkeypatch.setenv("CRON_TOKEN", "secret-cron")
    r = client.post("/internal/digest/run", headers={"X-Cron-Token": "secret-cron"})
    assert r.status_code == 200
    assert r.json() == {"ran": False, "result": None}
