import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


uploader = load("upload_legacy")
checker = load("check_backend")


class FakeAws:
    """Stack outputs, S3 and a migration Lambda that echoes the uploaded bundle's hash."""

    def __init__(self, target=None, fail_mode=None):
        self.target = target or {"game_saves": 0, "chat_messages": 0}
        self.fail_mode = fail_mode
        self.objects = {}
        self.invocations = []

    def client(self, name):
        return self

    def describe_stacks(self, StackName):
        return {"Stacks": [{"Outputs": [
            {"OutputKey": "LegacyImportBucketName", "OutputValue": "import-bucket"},
            {"OutputKey": "MigrationFunctionName", "OutputValue": "migration-fn"},
        ]}]}

    def put_object(self, Bucket, Key, Body, **kwargs):
        self.objects[(Bucket, Key)] = (Body, kwargs)

    def invoke(self, FunctionName, InvocationType, Payload):
        payload = json.loads(Payload)
        self.invocations.append((FunctionName, payload))
        if payload["mode"] == self.fail_mode:
            body = {"errorMessage": "migration-target-not-empty"}
            return {"FunctionError": "Unhandled", "Payload": io.BytesIO(json.dumps(body).encode())}
        data = self.objects[(payload["bucket"], payload["key"])][0]
        body = {"mode": payload["mode"], "bundleSha256": hashlib.sha256(data).hexdigest(), "counts": {"saves": 1}}
        if payload["mode"] == "dry-run":
            body["target"] = self.target
        else:
            body["status"] = "succeeded"
        return {"Payload": io.BytesIO(json.dumps(body).encode())}


class UploadTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.bundle = Path(self.tmp.name) / "bundle.json"
        self.bundle.write_text(json.dumps({"formatVersion": 1, "game": {"save": {"version": 4}}}), encoding="utf-8")
        self.hash = hashlib.sha256(self.bundle.read_bytes()).hexdigest()

    def tearDown(self):
        self.tmp.cleanup()

    def args(self, **overrides):
        values = {"bundle": self.bundle, "stack_name": "careersphere", "bucket": None, "function": None, "do_import": False}
        return Namespace(**{**values, **overrides})

    def test_default_run_uploads_encrypted_and_only_dry_runs(self):
        aws = FakeAws()
        summary = uploader.run(self.args(), aws.client, log=lambda _: None)
        (bucket, key), (_, options) = next(iter(aws.objects.items()))
        self.assertEqual(bucket, "import-bucket")
        self.assertTrue(key.startswith("legacy/") and key.endswith(f"-{self.hash[:12]}.json"))
        self.assertEqual(options["ServerSideEncryption"], "AES256")
        self.assertEqual([payload["mode"] for _, payload in aws.invocations], ["dry-run"])
        self.assertEqual(aws.invocations[0][0], "migration-fn")
        self.assertIsNone(summary["imported"])

    def test_import_passes_the_verified_hash(self):
        aws = FakeAws()
        summary = uploader.run(self.args(do_import=True), aws.client, log=lambda _: None)
        self.assertEqual([payload["mode"] for _, payload in aws.invocations], ["dry-run", "import"])
        self.assertEqual(aws.invocations[1][1]["bundleSha256"], self.hash)
        self.assertEqual(summary["imported"]["status"], "succeeded")

    def test_import_refuses_a_non_empty_database(self):
        aws = FakeAws(target={"game_saves": 1, "chat_messages": 0})
        with self.assertRaisesRegex(uploader.UploadError, "not empty.*game_saves"):
            uploader.run(self.args(do_import=True), aws.client, log=lambda _: None)
        self.assertEqual([payload["mode"] for _, payload in aws.invocations], ["dry-run"])

    def test_lambda_errors_are_reported(self):
        aws = FakeAws(fail_mode="dry-run")
        with self.assertRaisesRegex(uploader.UploadError, "migration-target-not-empty"):
            uploader.run(self.args(), aws.client, log=lambda _: None)

    def test_rejects_files_that_are_not_export_bundles(self):
        self.bundle.write_text('{"version": 4}', encoding="utf-8")
        with self.assertRaisesRegex(uploader.UploadError, "formatVersion"):
            uploader.run(self.args(), FakeAws().client, log=lambda _: None)


class CheckBackendTests(unittest.TestCase):
    def run_check(self, responses):
        lines = []
        calls = []

        def fetch(url, token):
            calls.append((url, token))
            return responses[len(calls) - 1]

        ok = checker.check("https://api.example/", "secret-token", fetch, lines.append)
        return ok, lines, calls

    def test_healthy_backend_reads_save_without_printing_the_token(self):
        ok, lines, calls = self.run_check([(200, {"ok": True, "region": "ap-southeast-1"}), (200, {"version": 0, "state": None})])
        self.assertTrue(ok)
        self.assertEqual([url for url, _ in calls], ["https://api.example/v1/health", "https://api.example/v1/game/save?playerId=main"])
        self.assertNotIn("secret-token", "\n".join(lines))

    def test_wrong_token_is_explained(self):
        ok, lines, _ = self.run_check([(401, {"error": "unauthorized"})])
        self.assertFalse(ok)
        self.assertIn("token was rejected", lines[0])

    def test_missing_settings_fail_without_a_request(self):
        lines = []
        self.assertFalse(checker.check("", "token", lambda *_: self.fail("no request expected"), lines.append))

    def test_env_file_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            env.write_text('# comment\nAWS_BACKEND_URL="https://api.example"\nAWS_BACKEND_TOKEN=abc\n', encoding="utf-8")
            self.assertEqual(checker.read_env_file(env), {"AWS_BACKEND_URL": "https://api.example", "AWS_BACKEND_TOKEN": "abc"})


if __name__ == "__main__":
    unittest.main()
