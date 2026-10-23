# CareerSphere AWS backend

This directory contains deployment templates and an operator-run data migration for the existing CareerSphere project. It does not create AWS resources by itself. Nothing here has been deployed to an AWS account or verified against the connected account.

## Architecture

```text
Game browser ──> Replit game server ──┐
                                      ├── HTTPS + server-only bearer token ──> HTTP API Gateway
Chatbot ───────> Replit chatbot ──────┘                                      │
                                                                              ├── typed Python Lambda
                                                                              ├── async AI-job worker
                                                                              └── RDS Data API
                                                                                       │
                                                                    private Aurora PostgreSQL
                                                                                       │
                                                           Bedrock Converse / optional direct DeepSeek
```

- Aurora is encrypted and placed in two isolated subnets with no public route, no inbound security-group rules, and `PubliclyAccessible: false`. The application uses the RDS Data API; no database port or credential is exposed to Replit.
- The public HTTP API accepts only named application operations. The Lambda verifies a generated bearer token from Secrets Manager; it does not accept SQL.
- The API and importer use a generated application DML login. The AI worker gets a separate database login limited to reading/updating `ai_jobs`. Only the schema custom-resource function reads the Aurora-managed administrator secret and applies DDL; runtime code does not receive the administrator password.
- Replit calls AWS only from server-side code. `AWS_BACKEND_TOKEN` must never use a `VITE_` prefix or be put in browser code.
- `AWS_BACKEND_URL` and `AWS_BACKEND_TOKEN` are a pair. Leaving both unset selects local development storage/providers; configuring only one fails closed instead of silently splitting data between local and AWS.
- Bedrock is the default provider once both AWS backend settings are configured. The user-facing app does not call Bedrock directly. Bedrock model selection, Region, and permission must be verified by the AWS account owner before deployment.
- `deepseek_direct` is an optional, explicit provider. It is disabled in the stack by default; if enabled, its official API key remains in AWS Secrets Manager and is read only by the AI worker. There is no automatic fallback between providers.
- `schema.sql` reflects the current game JSON save/market/trends and chatbot SQLite tables. It is not a recovered copy of an earlier PostgreSQL schema.

## Current coverage and boundaries

| Existing source | AWS destination |
| --- | --- |
| `GamePlat/game/server/data/save.json` | `game_saves.state` |
| Game market/trends JSON documents | `app_documents` |
| Chatbot SQLite `messages` | `chat_messages` |
| `seen_messages` | `seen_messages` |
| `reports` | `learning_reports` |
| `report_events` | `api_idempotency` legacy markers |
| `pending_confirmations` | `pending_confirmations` |
| Save's recorded digests | `daily_digests` |

Game save and document writes use version checks. A cloud-loaded legacy save is normalized through the same versioned migration and validation used by the local JSON store. Chat/report/digest operations use idempotency keys, and the game save plus its report/digest records are committed in one Aurora transaction. Chatbot SQLite remains the local-development fallback when AWS settings are absent; when AWS is configured, startup does not initialize a new local SQLite database.

The public API does not provide arbitrary table access. The migration function is not attached to API Gateway and must be invoked directly by an operator with Lambda invoke permission.

## Before deployment: verify the account and Region

Do not copy a model ID or Aurora engine version from an example. Verify each value in the AWS console or AWS CLI in the intended account:

1. Choose the deployment Region and check that it has at least two Availability Zones.
2. Check that the chosen Aurora PostgreSQL engine version supports Serverless v2 and the RDS Data API in that Region. See [Aurora Data API Region and engine support](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.Aurora_Fea_Regions_DB-eng.Feature.Data_API.html).
3. In Amazon Bedrock, verify the exact DeepSeek model/inference-profile ID, model ARN, Region availability, model access, and quota. The Lambda currently uses the Bedrock `Converse` API, which only works with models that support messages; verify that for the chosen DeepSeek target in [the Converse API reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html). If it does not support Converse, the worker needs a model-specific `InvokeModel` adapter before deployment.
4. Supply `AuroraPostgresEngineVersion`, `BedrockRegion`, `BedrockModelId`, and `BedrockInvokeResourceArns` as explicit stack parameters. For a cross-Region inference profile, include every exact ARN required by that profile's IAM guidance. The template intentionally has no guessed engine or model values.
5. If direct DeepSeek is required, create a Secrets Manager secret named `careersphere/deepseek` with a JSON field named `DEEPSEEK_API_KEY`; verify the official API model identifier and provide its exact value. Leave `EnableDeepSeekDirect=false` otherwise.

The connected Replit AWS integration available to this project exposes Cognito identity metadata only. It cannot inspect this account's Aurora resources, Region, Bedrock access, or model quotas. Those checks have not been performed here.

## Deploy the AWS stack

Use an AWS role for the intended account, with permissions limited to the stack's CloudFormation, SAM/CloudFormation artifacts, Lambda, API Gateway, RDS, EC2 VPC/subnet/security-group creation, Secrets Manager, S3, CloudWatch Logs, X-Ray, and `iam:PassRole` for the four roles in this template. Do not use long-lived AWS access keys in Replit. The deploying identity should be able to create/update the stack and pass only the stack's Lambda roles.

Install/use AWS SAM CLI in an operator-controlled environment, then:

```sh
cd aws
sam validate --lint --template-file template.yaml
sam build --template-file template.yaml
sam deploy --guided --template-file .aws-sam/build/template.yaml
```

During guided deployment:

- Set a unique stack name and the verified parameter values above.
- Keep direct DeepSeek disabled unless its secret and model have been deliberately configured.
- Confirm `CAPABILITY_IAM` when prompted.
- Review the change set before accepting. The Aurora cluster and instance have `DeletionPolicy: Retain`; deleting the stack will not delete the database.
- Review the stack outputs. `AwsBackendUrl` is the URL for Replit. The generated token secret is not emitted as an output value—only its ARN is.

After the stack is ready:

1. In AWS Secrets Manager, retrieve the generated value for the `careersphere/aws-backend-token` secret.
2. Add the stack's `AwsBackendUrl` as Replit secret `AWS_BACKEND_URL`, and add the retrieved secret value as Replit secret `AWS_BACKEND_TOKEN`. Set these on both the game server and chatbot runtime if they run in separate Replit deployments. Do not put the token in source files, browser variables, logs, or chat.
3. Set `AI_PROVIDER=bedrock` only after the backend and model are verified. With AWS settings unset, the app keeps its existing local persistence and configured local AI-provider behavior.
4. Restart the Replit services and check their health/CloudWatch logs. A failed AWS call is surfaced; it does not silently switch storage or AI provider.

For future database changes, add an idempotent migration to `schema.sql` and increment `SchemaVersion` on `ApplyDatabaseSchema`. Validate the change in a disposable stack before applying it to production data.

## Export and migrate existing local data

The exporter reads the existing game JSON files and chatbot SQLite database. It does not contact AWS. Its normal export also makes read-only copies of the source files/database in a new directory with restrictive permissions. The output contains chat content and should be treated as private personal data.

First inspect the source paths and counts without writing files:

```sh
python aws/lambda/scripts/export_legacy.py --dry-run
```

If the dry run reports that the game save is missing, first open and save the game, or supply the actual `--save-dir` path. Then export to a private location, never to Git:

Before the final export, pause the game and chatbot writers so the game JSON,
SQLite backup, and counts stay stable through upload/import. Keep the services
paused until the migrated data has been verified.

```sh
python aws/lambda/scripts/export_legacy.py \
  --output "$HOME/careersphere-migration/legacy-bundle.json" \
  --backup-dir "$HOME/careersphere-migration/source-backup"
```

The command refuses to overwrite an existing output or backup directory. Keep the source backup until the imported records have been verified. The bundle is capped at 8 MB by the Lambda importer; larger exports need a separately reviewed batched migration, not an increased timeout alone.

Upload the bundle to the stack's private, versioned `LegacyImportBucketName` bucket over TLS. Use a unique key, and keep its SHA-256:

```sh
sha256sum "$HOME/careersphere-migration/legacy-bundle.json"
aws s3 cp "$HOME/careersphere-migration/legacy-bundle.json" \
  "s3://BUCKET_FROM_STACK_OUTPUT/legacy/legacy-bundle.json"
```

The first import must target an empty application database. Run a dry-run first and review all counts and the target table counts. The dry-run does not modify the database:

```sh
aws lambda invoke \
  --function-name MIGRATION_FUNCTION_FROM_STACK_OUTPUT \
  --cli-binary-format raw-in-base64-out \
  --payload '{"mode":"dry-run","bucket":"BUCKET_FROM_STACK_OUTPUT","key":"legacy/legacy-bundle.json"}' \
  /tmp/careersphere-migration-dry-run.json
cat /tmp/careersphere-migration-dry-run.json
```

Only if the target counts are all zero and the bundle hash/counts match expectations, run the import. Save the returned SHA-256 and output:

```sh
aws lambda invoke \
  --function-name MIGRATION_FUNCTION_FROM_STACK_OUTPUT \
  --cli-binary-format raw-in-base64-out \
  --payload '{"mode":"import","bucket":"BUCKET_FROM_STACK_OUTPUT","key":"legacy/legacy-bundle.json","bundleSha256":"SHA256_FROM_DRY_RUN"}' \
  /tmp/careersphere-migration-import.json
cat /tmp/careersphere-migration-import.json
```

The importer validates the source, serializes concurrent runs, rejects a non-empty target, stores a pre-import database snapshot, writes all imported rows in a transaction, and records the bundle hash. Repeating a successful import of the same bundle is idempotent. Keep the source backup and S3 object until a separate verification and retention decision is complete.

### Rollback

Rollback is destructive: it removes application rows and restores the pre-import snapshot. The importer refuses rollback if it detects newer writes to saved application tables.

First preview the impact:

```sh
aws lambda invoke \
  --function-name MIGRATION_FUNCTION_FROM_STACK_OUTPUT \
  --cli-binary-format raw-in-base64-out \
  --payload '{"mode":"rollback-preview","bundleSha256":"SHA256_FROM_IMPORT"}' \
  /tmp/careersphere-rollback-preview.json
cat /tmp/careersphere-rollback-preview.json
```

Proceed only if `safeToRollback` is true and the owner has confirmed the impact:

```sh
aws lambda invoke \
  --function-name MIGRATION_FUNCTION_FROM_STACK_OUTPUT \
  --cli-binary-format raw-in-base64-out \
  --payload '{"mode":"rollback","bundleSha256":"SHA256_FROM_IMPORT","confirmRollback":true}' \
  /tmp/careersphere-rollback.json
cat /tmp/careersphere-rollback.json
```

If preview reports post-import writes, do not bypass the guard. Preserve those writes and plan a forward repair or separately reviewed restore.

## Verification

Local verification commands:

```sh
python -m unittest discover -s aws/lambda/tests -v
python -m unittest discover -s chatbot/tests -v
cd GamePlat/game
node --test server/*.test.mjs
npm run build
```

AWS-specific integration checks still need to be run after stack deployment: Data API access in the selected Region, a save/document round trip through the authenticated API, the selected Bedrock model's Converse response, and one export dry-run/import/rollback-preview against a disposable database. No live AWS resources or Bedrock inference have been tested by this project change.

## Cost drivers

The account and Region were not inspected, so a dollar quote would be misleading. Use the [AWS Pricing Calculator](https://calculator.aws/) with the actual Region and traffic. Expected line items are:

- **Aurora PostgreSQL Serverless v2**: minimum ACU-hours (template default is 0.5 ACU), scaling above the minimum, database storage, I/O, and retained backups/snapshots. This is likely the main steady cost because the database minimum can continue to accrue while the stack is idle.
- **Amazon Bedrock**: model-specific input/output tokens or inference-profile pricing. Use the exact selected DeepSeek target's Region-specific rate and expected chatbot/game token volume.
- **API Gateway HTTP API**: request volume and data transfer.
- **Lambda**: invocation count, allocated memory, and run duration; longer AI jobs use a 1 GB worker with a 5-minute limit.
- **Secrets Manager**: the backend token secret, database managed secret, and optional DeepSeek secret, plus API calls.
- **S3**: migration bundle storage, versions, and requests.
- **CloudWatch Logs and AWS X-Ray**: log ingestion/retention and traces. Set retention appropriate to the support need.
- **Data transfer/tax**: Region, user traffic, and local tax rules can affect the final bill. This design uses the RDS Data API and does not require a NAT Gateway for application-to-database access.

The stack defaults to two AZs and a 0.5–2 ACU scaling range. Confirm these capacity settings against the engine/Region and expected workload before accepting the CloudFormation change set. Reducing maximum capacity lowers the cap but can make the database slower under load; it does not remove the minimum ACU charge.

## Reference pricing and service behavior

- [Aurora pricing](https://aws.amazon.com/rds/aurora/pricing/)
- [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)
- [API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/)
- [Lambda pricing](https://aws.amazon.com/lambda/pricing/)
- [Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [RDS Data API supported Regions and engines](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.Aurora_Fea_Regions_DB-eng.Feature.Data_API.html)
