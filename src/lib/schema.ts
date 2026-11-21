// Database schema. Runs on startup with IF NOT EXISTS, so it is safe to re-run.
// Statements are separated by ";\n".
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS canon_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL,
  size text,
  keywords text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS rules (
  id text PRIMARY KEY,
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  do_example text,
  dont_example text,
  severity text NOT NULL DEFAULT 'major',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS facts (
  id text PRIMARY KEY,
  statement text NOT NULL,
  product_id text,
  kind text NOT NULL DEFAULT 'claim',
  source text,
  owner text,
  valid_from date,
  valid_until date,
  status text NOT NULL DEFAULT 'active',
  suggested_copy text,
  duration_days numeric,
  price numeric,
  check_pattern text,
  check_value text,
  keywords text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS terms (
  id text PRIMARY KEY,
  kind text NOT NULL,
  variants text NOT NULL,
  replacement text,
  rule_id text,
  severity text NOT NULL DEFAULT 'major',
  note text
);
CREATE TABLE IF NOT EXISTS palette (
  id text PRIMARY KEY,
  name text NOT NULL,
  hex text NOT NULL
);
CREATE TABLE IF NOT EXISTS confidential_terms (
  id text PRIMARY KEY,
  phrase text NOT NULL,
  note text
);
CREATE TABLE IF NOT EXISTS submissions (
  id serial PRIMARY KEY,
  title text NOT NULL,
  channel text NOT NULL,
  author_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  risk_tier text NOT NULL DEFAULT 'standard',
  draft_text text NOT NULL DEFAULT '',
  image_data text,
  image_alt text,
  image_text text,
  current_version int NOT NULL DEFAULT 0,
  review_record jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS versions (
  id serial PRIMARY KEY,
  submission_id int NOT NULL,
  n int NOT NULL,
  text text NOT NULL,
  image_alt text,
  image_text text,
  canon_version int NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checks (
  id serial PRIMARY KEY,
  submission_id int NOT NULL,
  version_n int NOT NULL,
  duration_ms int NOT NULL,
  ai_used boolean NOT NULL DEFAULT false,
  ai_model text,
  redactions int NOT NULL DEFAULT 0,
  intent jsonb,
  image_report jsonb,
  notes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS findings (
  id serial PRIMARY KEY,
  submission_id int NOT NULL,
  version_n int NOT NULL,
  location text NOT NULL DEFAULT 'text',
  category text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  quote text,
  suggestion text,
  sources jsonb NOT NULL DEFAULT '[]',
  method text NOT NULL DEFAULT 'code',
  status text NOT NULL DEFAULT 'open',
  decision_reason text,
  decided_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rule_feedback (
  id serial PRIMARY KEY,
  rule_id text NOT NULL,
  kind text NOT NULL,
  quote text,
  note text,
  submission_id int,
  user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rule_feedback_rule_idx ON rule_feedback (rule_id);
CREATE TABLE IF NOT EXISTS false_alarms (
  id serial PRIMARY KEY,
  rule_id text NOT NULL,
  quote_norm text NOT NULL,
  quote text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, quote_norm)
);
CREATE TABLE IF NOT EXISTS comments (
  id serial PRIMARY KEY,
  submission_id int NOT NULL,
  author_id text NOT NULL,
  body text NOT NULL,
  quote text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS approvals (
  id serial PRIMARY KEY,
  submission_id int NOT NULL,
  version_n int NOT NULL,
  approver_id text NOT NULL,
  role text NOT NULL,
  decision text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id serial PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  submission_id int,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_calls (
  id serial PRIMARY KEY,
  submission_id int,
  purpose text NOT NULL,
  model text NOT NULL,
  redacted_input text,
  ok boolean NOT NULL,
  latency_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE versions ADD COLUMN IF NOT EXISTS image_hash text;
CREATE INDEX IF NOT EXISTS findings_sub_idx ON findings (submission_id, version_n);
CREATE INDEX IF NOT EXISTS audit_sub_idx ON audit_events (submission_id)
`;
