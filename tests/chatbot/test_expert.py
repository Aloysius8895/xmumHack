import pytest

from app import career_api, classify, db
from test_telegram import _capture_telegram, _text_message, _update, post_update, USER_ID, TOKEN, SECRET


@pytest.fixture
def expert_client(client, monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", TOKEN)
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", SECRET)
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", str(USER_ID))
    return client


def intro(name="Hans Rosling", career_id="data-analyst"):
    return {"active": True, "reply": f"I am an AI perspective based on {name}'s public records. Ask me a question. /exit to leave.", "careerId": career_id, "expert": {"name": name}, "lang": "en", "history": []}


def test_intro_followup_and_exit_preserve_normal_chat_and_reports(expert_client, monkeypatch, fake_ai):
    sent = _capture_telegram(monkeypatch)
    calls = []

    def expert(text, from_, action, session=None):
        calls.append((text, from_, action, session))
        if action == "enter":
            return intro()
        return {**intro(), "reply": "Look at the evidence.", "history": [{"role": "user", "content": text}, {"role": "assistant", "content": "Look at the evidence."}]}

    monkeypatch.setattr(career_api, "expert", expert)
    post_update(expert_client, _update(_text_message("/expert")))
    assert "Hans Rosling" in sent[-1]["payload"]["text"]
    post_update(expert_client, _update(_text_message("How do I analyse data?")))
    assert sent[-1]["payload"]["text"] == "Look at the evidence."
    assert calls[-1][2] == "ask"
    assert calls[-1][3]["careerId"] == "data-analyst"
    assert db.history(f"tg:{USER_ID}", 20) == []
    assert db.reports_for_date(db.today_myt()) == []
    post_update(expert_client, _update(_text_message("/exit")))
    assert db.get_expert_session(f"tg:{USER_ID}") is None
    post_update(expert_client, _update(_text_message("Hello companion")))
    assert len(fake_ai) == 1


def test_web_target_change_and_missing_expert_update_session(expert_client, monkeypatch):
    sent = _capture_telegram(monkeypatch)
    answers = iter([intro(), intro("Andrej Karpathy", "ml-engineer"), {"active": False, "reply": "This target has no expert available."}])
    monkeypatch.setattr(career_api, "expert", lambda *args, **kwargs: next(answers))
    for text in ["/expert", "How do I learn ML?"]:
        post_update(expert_client, _update(_text_message(text)))
    assert db.get_expert_session(f"tg:{USER_ID}")["careerId"] == "ml-engineer"
    post_update(expert_client, _update(_text_message("Another question")))
    assert db.get_expert_session(f"tg:{USER_ID}") is None
    assert "no expert" in sent[-1]["payload"]["text"]


@pytest.mark.parametrize("command", ["/reset", "/start", "/exit", "/reset@CareerSphere_bot", "/start@CareerSphere_bot"])
def test_reset_and_start_leave_expert_mode(expert_client, monkeypatch, command):
    _capture_telegram(monkeypatch)
    db.set_expert_session(f"tg:{USER_ID}", intro())
    post_update(expert_client, _update(_text_message(command)))
    assert db.get_expert_session(f"tg:{USER_ID}") is None


def test_reset_with_bot_suffix_is_handled_before_classification(expert_client, monkeypatch, fake_ai):
    sent = _capture_telegram(monkeypatch)
    uid = f"tg:{USER_ID}"
    db.set_expert_session(uid, intro())
    db.set_pending(uid, "Possible report", "en")

    def fail_if_classified(*_args, **_kwargs):
        raise AssertionError("/reset must not reach the AI classifier")

    monkeypatch.setattr(classify, "classify_message", fail_if_classified)
    post_update(expert_client, _update(_text_message("/reset@CareerSphere_bot")))

    assert db.get_expert_session(uid) is None
    assert db.pop_pending(uid) is None
    assert fake_ai == []
    assert sent[-1]["payload"]["text"]


@pytest.mark.parametrize("command", ["/expert", "/expert@KerjayaKu_bot", "/exit", "/exit@KerjayaKu_bot"])
def test_expert_commands_are_handled_before_classification(expert_client, monkeypatch, fake_ai, command):
    sent = _capture_telegram(monkeypatch)
    calls = []

    def expert(text, from_, action, session=None):
        calls.append(action)
        return intro()

    def fail_if_classified(*_args, **_kwargs):
        raise AssertionError(f"{command} must not reach the AI classifier")

    monkeypatch.setattr(career_api, "expert", expert)
    monkeypatch.setattr(classify, "classify_message", fail_if_classified)
    post_update(expert_client, _update(_text_message(command)))

    if command.startswith("/expert"):
        assert calls == ["enter"]
        assert "Hans Rosling" in sent[-1]["payload"]["text"]
    else:
        assert calls == []
        assert "expert mode ended" in sent[-1]["payload"]["text"].lower()
    assert fake_ai == []


def test_single_owner_binding_is_required_and_other_users_cannot_read_the_web_target(expert_client, monkeypatch):
    sent = _capture_telegram(monkeypatch)

    def fail(*args, **kwargs):
        raise AssertionError("The web target must not be read for another Telegram user")

    monkeypatch.setattr(career_api, "expert", fail)
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", "123")
    post_update(expert_client, _update(_text_message("/expert")))
    assert "owner" in sent[-1]["payload"]["text"].lower()
    monkeypatch.setenv("TELEGRAM_ALLOWED_USER_IDS", "")
    post_update(expert_client, _update(_text_message("/expert")))
    assert "owner" in sent[-1]["payload"]["text"].lower()


def test_failure_never_silently_switches_to_generic_chat(expert_client, monkeypatch, fake_ai):
    sent = _capture_telegram(monkeypatch)
    db.set_expert_session(f"tg:{USER_ID}", intro())

    def fail(*args, **kwargs):
        raise career_api.CareerAPIError("timeout")

    monkeypatch.setattr(career_api, "expert", fail)
    post_update(expert_client, _update(_text_message("What do you think?")))
    assert fake_ai == []
    assert db.get_expert_session(f"tg:{USER_ID}") is not None
    assert "try again" in sent[-1]["payload"]["text"].lower()


def test_n8n_bridge_routes_expert_and_deduplicates_delivery(expert_client, monkeypatch):
    _capture_telegram(monkeypatch)
    calls = []
    monkeypatch.setattr(career_api, "expert", lambda *args, **kwargs: calls.append((args, kwargs)) or intro())
    update = _update(_text_message("/expert@CareerSphere_bot"))
    for _ in range(2):
        result = expert_client.post("/internal/n8n/telegram", json=update, headers={"X-Telegram-Bot-Api-Secret-Token": SECRET})
        assert result.status_code == 200
    assert len(calls) == 1
    assert db.get_expert_session(f"tg:{USER_ID}")["careerId"] == "data-analyst"


def test_expert_client_sends_stable_delivery_id_and_prior_session(expert_client, monkeypatch):
    import httpx
    monkeypatch.setenv("CAREERSPHERE_API_URL", "https://game.example")
    monkeypatch.setenv("INTEGRATION_TOKEN", "test-integration")
    sent = []

    def fake_post(url, json=None, headers=None, **kwargs):
        sent.append((url, json, headers))
        return httpx.Response(200, json=intro(), request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    token = db.CURRENT_EVENT.set("tg:stable")
    try:
        career_api.expert("Question", f"tg:{USER_ID}", "ask", {"careerId": "data-analyst", "history": []})
    finally:
        db.CURRENT_EVENT.reset(token)
    assert sent[0][0] == "https://game.example/api/integrations/expert"
    assert sent[0][1]["messageId"] == "tg:stable"
    assert sent[0][1]["careerId"] == "data-analyst"
    assert sent[0][2]["Authorization"] == "Bearer test-integration"


def test_expert_sessions_use_cloud_storage_when_enabled(monkeypatch):
    from app import aws_backend
    calls = []
    state = {"careerId": "data-analyst", "lang": "en", "history": []}
    monkeypatch.setattr(aws_backend, "enabled", lambda: True)
    monkeypatch.setattr(aws_backend, "data_call", lambda method, path, **kwargs: calls.append((method, path, kwargs)) or {"session": state})
    db.set_expert_session("tg:123", state)
    assert db.get_expert_session("tg:123") == state
    db.clear_expert_session("tg:123")
    assert [call[0] for call in calls] == ["PUT", "GET", "DELETE"]
    assert all(call[1] == "/v1/chat/expert-session" for call in calls)


def test_session_round_trip_and_new_entry_clear_stale_report_confirmations(expert_client, monkeypatch):
    _capture_telegram(monkeypatch)
    uid = f"tg:{USER_ID}"
    db.set_pending(uid, "Old possible report", "en")
    monkeypatch.setattr(career_api, "expert", lambda *args, **kwargs: intro())
    post_update(expert_client, _update(_text_message("/expert")))
    assert db.pop_pending(uid) is None
    db.init_db()  # Simulate restarting the service with the same SQLite file.
    assert db.get_expert_session(uid)["careerId"] == "data-analyst"
