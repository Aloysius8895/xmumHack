#!/usr/bin/env python3
"""Upload an export_legacy.py bundle to the deployed stack and run the migration Lambda.

Without --import this only uploads and runs the importer's dry-run, which never
writes to the database. With --import it then imports, but only when the dry-run
confirms the same bundle hash and an empty target database.

Needs AWS credentials (aws configure / aws sso login) allowed to read the stack
outputs, s3:PutObject on the import bucket and lambda:InvokeFunction on the
migration function. Requires boto3 (pip install boto3).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

MAX_BUNDLE_BYTES = 8_000_000


class UploadError(Exception):
    pass


def read_bundle(path: Path) -> tuple[bytes, str]:
    if not path.is_file():
        raise UploadError(f"Bundle not found: {path}")
    data = path.read_bytes()
    if len(data) > MAX_BUNDLE_BYTES:
        raise UploadError("Bundle exceeds the importer's 8 MB limit.")
    try:
        bundle = json.loads(data)
    except json.JSONDecodeError as exc:
        raise UploadError("Bundle is not JSON; create it with export_legacy.py.") from exc
    if not isinstance(bundle, dict) or bundle.get("formatVersion") != 1:
        raise UploadError("Bundle formatVersion must be 1; create it with export_legacy.py.")
    return data, hashlib.sha256(data).hexdigest()


def stack_outputs(cloudformation: Any, stack_name: str) -> dict[str, str]:
    stacks = cloudformation.describe_stacks(StackName=stack_name)["Stacks"]
    return {item["OutputKey"]: item["OutputValue"] for item in stacks[0].get("Outputs", [])}


def invoke(lambda_client: Any, function: str, payload: dict) -> dict:
    response = lambda_client.invoke(
        FunctionName=function,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode("utf-8"),
    )
    result = json.loads(response["Payload"].read() or b"null")
    if response.get("FunctionError"):
        message = result.get("errorMessage") if isinstance(result, dict) else result
        raise UploadError(f"Migration Lambda failed ({payload['mode']}): {message}")
    return result


def run(args: argparse.Namespace, client: Callable[[str], Any], log: Callable[[str], None] = print) -> dict:
    data, bundle_hash = read_bundle(args.bundle)

    bucket, function = args.bucket, args.function
    if not bucket or not function:
        outputs = stack_outputs(client("cloudformation"), args.stack_name)
        bucket = bucket or outputs.get("LegacyImportBucketName")
        function = function or outputs.get("MigrationFunctionName")
        if not bucket or not function:
            raise UploadError(f"Stack {args.stack_name} has no LegacyImportBucketName/MigrationFunctionName outputs.")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    key = f"legacy/{stamp}-{bundle_hash[:12]}.json"
    client("s3").put_object(
        Bucket=bucket, Key=key, Body=data,
        ContentType="application/json", ServerSideEncryption="AES256",
    )
    log(f"Uploaded {len(data)} bytes to s3://{bucket}/{key} (sha256 {bundle_hash})")

    lambda_client = client("lambda")
    dry_run = invoke(lambda_client, function, {"mode": "dry-run", "bucket": bucket, "key": key})
    log("Dry-run: " + json.dumps(dry_run, ensure_ascii=False, indent=2))
    if dry_run.get("bundleSha256") != bundle_hash:
        raise UploadError("The importer read a different bundle than the one uploaded; stopping.")

    summary = {"bucket": bucket, "key": key, "bundleSha256": bundle_hash, "dryRun": dry_run, "imported": None}
    if not args.do_import:
        log("Dry-run only. Re-run with --import after reviewing the counts above.")
        return summary

    occupied = {table: count for table, count in (dry_run.get("target") or {}).items() if count}
    if occupied:
        raise UploadError(f"Target database is not empty, refusing to import: {occupied}")
    summary["imported"] = invoke(lambda_client, function, {
        "mode": "import", "bucket": bucket, "key": key, "bundleSha256": bundle_hash,
    })
    log("Import: " + json.dumps(summary["imported"], ensure_ascii=False, indent=2))
    log(f"Keep this hash for rollback-preview/rollback: {bundle_hash}")
    return summary


def boto3_clients(region: str | None, profile: str | None) -> Callable[[str], Any]:
    try:
        import boto3
    except ImportError as exc:
        raise UploadError("boto3 is not installed: pip install boto3") from exc
    session = boto3.Session(region_name=region, profile_name=profile)
    return session.client


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bundle", type=Path, required=True, help="bundle written by export_legacy.py --output")
    parser.add_argument("--stack-name", default="careersphere", help="deployed SAM stack (default: careersphere)")
    parser.add_argument("--bucket", help="import bucket; default: the stack's LegacyImportBucketName output")
    parser.add_argument("--function", help="migration Lambda; default: the stack's MigrationFunctionName output")
    parser.add_argument("--region")
    parser.add_argument("--profile")
    parser.add_argument("--import", dest="do_import", action="store_true",
                        help="import after a clean dry-run (default: upload and dry-run only)")
    args = parser.parse_args(argv)
    try:
        run(args, boto3_clients(args.region, args.profile))
    except UploadError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
