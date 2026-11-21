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
CREATE INDEX IF NOT EXISTS audit_sub_idx ON audit_events (submission_id);
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in timestamptz
)
`;

/**
 * Access limits inside the database (row-level security).
 * Every query from a signed-in person runs as the role `verity_app`, which cannot bypass RLS,
 * with `verity.role` and `verity.uid` set for that one transaction (see db.ts).
 * So even a bug in the app code cannot let a creator read someone else's draft,
 * change a brand rule, or edit the audit log.
 * One statement per array item (some contain semicolons).
 */
const CANON = ["canon_meta", "products", "rules", "facts", "terms", "palette", "confidential_terms"];
const ALL = [...CANON, "submissions", "versions", "checks", "findings", "comments", "approvals", "audit_events", "ai_calls", "rule_feedback", "false_alarms"];
const pol = (t: string, name: string, body: string) => [`DROP POLICY IF EXISTS ${name} ON ${t}`, `CREATE POLICY ${name} ON ${t} ${body}`];
const SIGNED_IN = "verity_role() IN ('creator','manager','compliance','admin')";
const REVIEWER = "verity_role() IN ('manager','compliance','admin')";

export const RLS_SQL: string[] = [
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'verity_app') THEN CREATE ROLE verity_app NOLOGIN NOBYPASSRLS; END IF; END $$`,
  // grant only when missing: on hosted Postgres a second GRANT can be refused
  `DO $$ BEGIN IF NOT pg_has_role(current_user, 'verity_app', 'MEMBER') THEN EXECUTE 'GRANT verity_app TO ' || quote_ident(current_user); END IF; END $$`,
  `GRANT USAGE ON SCHEMA public TO verity_app`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ${ALL.join(", ")} TO verity_app`,
  `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO verity_app`,
  // passwords are never readable by the app role; sign-in runs as the system
  `REVOKE ALL ON accounts FROM verity_app`,
  `CREATE OR REPLACE FUNCTION verity_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('verity.role', true), ''), 'anon') $$`,
  `CREATE OR REPLACE FUNCTION verity_uid() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('verity.uid', true), '') $$`,
  `CREATE OR REPLACE FUNCTION verity_can_see(sid int) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM submissions s WHERE s.id = sid AND (verity_role() IN ('manager','compliance','admin') OR s.author_id = verity_uid())) $$`,
  ...ALL.map((t) => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`),
  // brand rules, facts, terms: everyone signed in can read; only the admin can change
  ...CANON.flatMap((t) => [...pol(t, "v_read", `FOR SELECT USING (${SIGNED_IN})`), ...pol(t, "v_admin_write", `FOR ALL USING (verity_role() = 'admin') WITH CHECK (verity_role() = 'admin')`)]),
  // submissions: creators see and edit only their own; reviewers see all
  ...pol("submissions", "v_read", `FOR SELECT USING (${REVIEWER} OR author_id = verity_uid())`),
  ...pol("submissions", "v_insert", `FOR INSERT WITH CHECK (${SIGNED_IN} AND author_id = verity_uid())`),
  ...pol("submissions", "v_update", `FOR UPDATE USING (verity_role() IN ('manager','compliance') OR author_id = verity_uid()) WITH CHECK (verity_role() IN ('manager','compliance') OR author_id = verity_uid())`),
  // everything hanging off a submission follows the submission
  ...["versions", "checks", "findings"].flatMap((t) => [
    ...pol(t, "v_read", `FOR SELECT USING (verity_can_see(submission_id))`),
    ...pol(t, "v_insert", `FOR INSERT WITH CHECK (verity_can_see(submission_id))`),
    ...pol(t, "v_update", `FOR UPDATE USING (verity_can_see(submission_id)) WITH CHECK (verity_can_see(submission_id))`),
  ]),
  ...pol("comments", "v_read", `FOR SELECT USING (verity_can_see(submission_id))`),
  ...pol("comments", "v_insert", `FOR INSERT WITH CHECK (verity_can_see(submission_id) AND author_id = verity_uid())`),
  // approvals: only reviewers, only as themselves, never edited
  ...pol("approvals", "v_read", `FOR SELECT USING (verity_can_see(submission_id))`),
  ...pol("approvals", "v_insert", `FOR INSERT WITH CHECK (${REVIEWER} AND approver_id = verity_uid())`),
  // audit log: append-only (no update or delete policy exists), written as yourself
  ...pol("audit_events", "v_read", `FOR SELECT USING (${REVIEWER} OR (submission_id IS NOT NULL AND verity_can_see(submission_id)))`),
  ...pol("audit_events", "v_insert", `FOR INSERT WITH CHECK (${SIGNED_IN} AND actor_id = verity_uid())`),
  // AI call log (redacted inputs): the admin sees all; others only calls about content they can see
  ...pol("ai_calls", "v_read", `FOR SELECT USING (verity_role() = 'admin' OR (submission_id IS NOT NULL AND verity_can_see(submission_id)))`),
  ...pol("ai_calls", "v_insert", `FOR INSERT WITH CHECK (${SIGNED_IN})`),
  // rule health
  ...pol("rule_feedback", "v_read", `FOR SELECT USING (${SIGNED_IN})`),
  ...pol("rule_feedback", "v_insert", `FOR INSERT WITH CHECK (${SIGNED_IN} AND user_id = verity_uid())`),
  ...pol("false_alarms", "v_read", `FOR SELECT USING (${SIGNED_IN})`),
  ...pol("false_alarms", "v_insert", `FOR INSERT WITH CHECK (${SIGNED_IN} AND created_by = verity_uid())`),
  ...pol("false_alarms", "v_delete", `FOR DELETE USING (verity_role() = 'admin')`),
];
