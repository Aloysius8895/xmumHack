#!/usr/bin/env python3
"""Check that AWS_BACKEND_URL and AWS_BACKEND_TOKEN reach the deployed API.

Reads both from the environment, or from --env-file (for example chatbot/.env).
Only reads: GET /v1/health and GET /v1/game/save. The token is never printed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable

Fetch = Callable[[str, str], tuple[int, dict]]


def read_env_file(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip().strip('"').strip("'")
    return values


def http_get(url: str, token: str) -> tuple[int, dict]:
    request = urllib.request.Request(url, headers={"authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read() or b"{}")
        except json.JSONDecodeError:
            return exc.code, {}


def check(url: str, token: str, fetch: Fetch = http_get, log: Callable[[str], None] = print) -> bool:
    if not url or not token:
        log("AWS_BACKEND_URL and AWS_BACKEND_TOKEN must both be set.")
        return False
    base = url.rstrip("/")
    try:
        status, body = fetch(f"{base}/v1/health", token)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        log(f"Cannot reach {base}: {exc}")
        return False
    if status == 401:
        log("Reached the API, but the token was rejected: AWS_BACKEND_TOKEN does not match careersphere/aws-backend-token.")
        return False
    if status != 200 or not body.get("ok"):
        log(f"Health check failed: HTTP {status} {body.get('error', '')}".rstrip())
        return False
    log(f"Health OK (region {body.get('region')})")

    status, body = fetch(f"{base}/v1/game/save?playerId=main", token)
    if status != 200:
        log(f"Database read failed: HTTP {status} {body.get('error', '')}".rstrip())
        return False
    log("Game save in AWS: " + ("none yet (version 0)" if body.get("state") is None else f"version {body.get('version')}"))
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, help="read AWS_BACKEND_URL/AWS_BACKEND_TOKEN from this file")
    args = parser.parse_args(argv)
    values = read_env_file(args.env_file) if args.env_file else {}
    url = values.get("AWS_BACKEND_URL") or os.getenv("AWS_BACKEND_URL", "")
    token = values.get("AWS_BACKEND_TOKEN") or os.getenv("AWS_BACKEND_TOKEN", "")
    return 0 if check(url, token) else 1


if __name__ == "__main__":
    raise SystemExit(main())
