CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_saves (
    player_id text PRIMARY KEY,
    version bigint NOT NULL DEFAULT 1,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_documents (
    document_id text PRIMARY KEY CHECK (document_id IN ('market', 'trends')),
    version bigint NOT NULL DEFAULT 1,
    payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages (user_id, created_at, id);

CREATE TABLE IF NOT EXISTS seen_messages (
    message_id text PRIMARY KEY,
    seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_reports (
    id text PRIMARY KEY,
    event_id text UNIQUE,
    user_id text NOT NULL,
    report_date date NOT NULL,
    text text NOT NULL,
    summary text,
    skill_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    advanced jsonb NOT NULL DEFAULT '[]'::jsonb,
    points integer,
    created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS learning_reports_date_idx ON learning_reports (report_date, created_at);
CREATE INDEX IF NOT EXISTS learning_reports_user_date_idx ON learning_reports (user_id, report_date, created_at);

CREATE TABLE IF NOT EXISTS pending_confirmations (
    user_id text PRIMARY KEY,
    text text NOT NULL,
    lang text NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_digests (
    digest_date date PRIMARY KEY,
    summary text NOT NULL DEFAULT '',
    skills jsonb NOT NULL DEFAULT '[]'::jsonb,
    summary_only boolean NOT NULL DEFAULT false,
    source text NOT NULL DEFAULT 'chatbot',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_idempotency (
    idempotency_key text PRIMARY KEY,
    fingerprint text NOT NULL,
    response jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_jobs (
    id text PRIMARY KEY,
    status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    request jsonb NOT NULL,
    result jsonb,
    error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_jobs_created_idx ON ai_jobs (created_at);

CREATE TABLE IF NOT EXISTS migration_runs (
    bundle_sha256 text PRIMARY KEY,
    status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'rolled_back')),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_code text
);

CREATE TABLE IF NOT EXISTS migration_backups (
    bundle_sha256 text PRIMARY KEY REFERENCES migration_runs(bundle_sha256),
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version) VALUES (1)
ON CONFLICT (version) DO NOTHING;
