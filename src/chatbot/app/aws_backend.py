"""Authenticated client for the AWS API Gateway business endpoints."""
from __future__ import annotations

import time
from typing import Any
from urllib.parse import quote

import httpx

from .config import get_settings

TIMEOUT = 20.0
AI_WAIT_SECONDS = 240.0


class AwsBackendError(RuntimeError):
    def __init__(self, code: str, status: int = 502):
        self.code = code
        self.status = status
        super().__init__(code)


def enabled() -> bool:
    st = get_settings()
    has_url = bool(st.aws_backend_url)
    has_token = bool(st.aws_backend_token)
    if has_url != has_token:
        raise AwsBackendError("aws-backend-config-incomplete", 503)
    return has_url


def request(method: str, path: str, *, body: dict | None = None, params: dict | None = None) -> dict:
    st = get_settings()
    if not st.aws_backend_url or not st.aws_backend_token:
        raise AwsBackendError("aws-backend-not-configured", 503)
    try:
        response = httpx.request(
            method,
            f"{st.aws_backend_url}{path}",
            json=body,
            params=params,
            headers={"Authorization": f"Bearer {st.aws_backend_token}"},
            timeout=TIMEOUT,
        )
    except httpx.TimeoutException as exc:
        raise AwsBackendError("aws-backend-timeout", 504) from exc
    except httpx.HTTPError as exc:
        raise AwsBackendError("aws-backend-offline", 502) from exc
    try:
        payload = response.json()
    except ValueError as exc:
        raise AwsBackendError("aws-backend-invalid-response", 502) from exc
    if not response.is_success and response.status_code != 202:
        raise AwsBackendError(str(payload.get("error") or "aws-backend-error"), response.status_code)
    return payload


def complete(provider: str, messages: list[dict], system: str | None, max_tokens: int = 600) -> str:
    job = request("POST", "/v1/ai/jobs", body={
        "provider": provider,
        "mode": "text",
        "system": system,
        "messages": messages,
        "maxTokens": max_tokens,
    })
    deadline = time.monotonic() + AI_WAIT_SECONDS
    while time.monotonic() < deadline:
        time.sleep(0.8)
        state = request("GET", f"/v1/ai/jobs/{quote(job['jobId'], safe='')}")
        if state.get("status") == "succeeded":
            return str(state.get("text") or "").strip()
        if state.get("status") == "failed":
            raise AwsBackendError(str(state.get("error") or "ai-error"), 502)
    raise AwsBackendError("ai-timeout", 504)


def data_call(method: str, path: str, *, body: dict | None = None, params: dict | None = None) -> dict:
    return request(method, path, body=body, params=params)
