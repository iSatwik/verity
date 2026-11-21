// Access-limit tests: runs the real schema and row-level-security policies in an in-process Postgres
// and tries what each role may and may not do. Also checks passwords and the signed session cookie.
// Run: npm run test:access
import { PGlite } from "@electric-sql/pglite";
import { SCHEMA_SQL, RLS_SQL } from "../src/lib/schema";
import { hashPassword, verifyPassword, signSession, verifySession } from "../src/lib/auth";

const db = new PGlite();
const SET_ACTOR = "SELECT set_config('role', 'verity_app', true), set_config('verity.role', $1, true), set_config('verity.uid', $2, true)";
type Who = { role: string; uid: string } | "system";
async function run(who: Who, sql: string, params: unknown[] = []) {
  if (who === "system") return (await db.query(sql, params)).rows;
  return db.transaction(async (tx) => {
    await tx.query(SET_ACTOR, [who.role, who.uid]);
    const r = await tx.query(sql, params);
    return r.affectedRows !== undefined && !/^\s*select/i.test(sql) && !/returning/i.test(sql) ? [{ affected: r.affectedRows }] : r.rows;
  });
}

const rahul = { role: "creator", uid: "u_rahul" };
const neha = { role: "creator", uid: "u_neha" }; // a second creator
const ritika = { role: "manager", uid: "u_ritika" };
const arjun = { role: "compliance", uid: "u_arjun" };
const satwik = { role: "admin", uid: "u_satwik" };
const anon = { role: "anon", uid: "" };

let pass = 0, fail = 0;
async function expect(name: string, who: Who, sql: string, params: unknown[], want: "allowed" | "blocked" | number) {
  let got: string;
  try {
    const rows = (await run(who, sql, params)) as Record<string, unknown>[];
    const affected = rows[0] && "affected" in rows[0] ? Number(rows[0].affected) : rows.length;
    got = typeof want === "number" ? String(affected) : affected > 0 ? "allowed" : "blocked";
  } catch {
    got = "blocked";
  }
  const ok = got === String(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(68)} ${ok ? "" : `(wanted ${want}, got ${got})`}`);
}

async function main() {
  for (const s of SCHEMA_SQL.split(";\n").map((x) => x.trim()).filter(Boolean)) await db.query(s);
  for (const s of RLS_SQL) await db.query(s);
  // fixtures, written as the system
  await db.query("INSERT INTO rules (id, category, title, body) VALUES ('V-01','voice','Warm','Be warm')");
  await db.query("INSERT INTO canon_meta (key, value) VALUES ('version','1')");
  await db.query("INSERT INTO submissions (id, title, channel, author_id) VALUES (1,'Rahul post','instagram','u_rahul'), (2,'Neha post','instagram','u_neha')");
  await db.query("INSERT INTO findings (submission_id, version_n, category, severity, title, message) VALUES (1,1,'voice','major','x','y'), (2,1,'voice','major','x','y')");
  await db.query("INSERT INTO audit_events (actor_id, action, submission_id) VALUES ('u_rahul','submission.created',1), ('u_neha','submission.created',2)");
  await db.query("INSERT INTO ai_calls (submission_id, purpose, model, ok) VALUES (NULL,'import','m',true), (2,'check','m',true), (1,'check','m',true)");
  await db.query("INSERT INTO accounts (id, email, role, password_hash) VALUES ('u_rahul','rahul@aranya.demo','creator','x')");

  console.log("\nCreators");
  await expect("creator sees own submission", rahul, "SELECT id FROM submissions WHERE id = 1", [], "allowed");
  await expect("creator cannot see another creator's submission", rahul, "SELECT id FROM submissions WHERE id = 2", [], "blocked");
  await expect("creator cannot see findings on another creator's submission", rahul, "SELECT id FROM findings WHERE submission_id = 2", [], "blocked");
  await expect("creator can edit own draft", rahul, "UPDATE submissions SET draft_text = 'x' WHERE id = 1", [], 1);
  await expect("creator cannot edit another creator's draft", rahul, "UPDATE submissions SET draft_text = 'x' WHERE id = 2", [], 0);
  await expect("creator cannot create a submission in someone else's name", rahul, "INSERT INTO submissions (title, channel, author_id) VALUES ('a','b','u_neha')", [], "blocked");
  await expect("creator cannot change a brand rule", rahul, "UPDATE rules SET body = 'anything goes' WHERE id = 'V-01'", [], 0);
  await expect("creator cannot add a brand rule", rahul, "INSERT INTO rules (id, category, title, body) VALUES ('X-1','v','t','b')", [], "blocked");
  await expect("creator cannot approve", rahul, "INSERT INTO approvals (submission_id, version_n, approver_id, role, decision) VALUES (1,1,'u_rahul','manager','approved')", [], "blocked");
  await expect("creator sees AI calls only for their own content", rahul, "SELECT id FROM ai_calls", [], 1);
  await expect("creator cannot write an audit entry as someone else", rahul, "INSERT INTO audit_events (actor_id, action) VALUES ('u_ritika','review.approved')", [], "blocked");
  await expect("another creator sees only their own submission", neha, "SELECT id FROM submissions", [], 1);

  console.log("\nReviewers");
  await expect("manager sees every submission", ritika, "SELECT id FROM submissions", [], 2);
  await expect("manager can approve as themselves", ritika, "INSERT INTO approvals (submission_id, version_n, approver_id, role, decision) VALUES (1,1,'u_ritika','manager','approved')", [], "allowed");
  await expect("manager cannot approve in someone else's name", ritika, "INSERT INTO approvals (submission_id, version_n, approver_id, role, decision) VALUES (1,1,'u_arjun','compliance','approved')", [], "blocked");
  await expect("compliance can approve as themselves", arjun, "INSERT INTO approvals (submission_id, version_n, approver_id, role, decision) VALUES (1,1,'u_arjun','compliance','approved')", [], "allowed");
  await expect("manager cannot change a brand rule", ritika, "UPDATE rules SET body = 'x' WHERE id = 'V-01'", [], 0);
  await expect("manager cannot read AI calls not tied to content", ritika, "SELECT id FROM ai_calls WHERE submission_id IS NULL", [], "blocked");

  console.log("\nAdmin");
  await expect("admin can change a brand rule", satwik, "UPDATE rules SET body = 'Be warm and plain' WHERE id = 'V-01'", [], 1);
  await expect("admin can bump the rules version", satwik, "UPDATE canon_meta SET value = '2' WHERE key = 'version' RETURNING value", [], "allowed");
  await expect("admin can read the whole AI call log", satwik, "SELECT id FROM ai_calls", [], 3);

  console.log("\nAudit log and passwords");
  for (const [n, who] of [["creator", rahul], ["manager", ritika], ["admin", satwik]] as const) {
    await expect(`${n} cannot edit the audit log`, who, "UPDATE audit_events SET action = 'nothing'", [], 0);
    await expect(`${n} cannot delete from the audit log`, who, "DELETE FROM audit_events", [], 0);
    await expect(`${n} cannot read password hashes`, who, "SELECT password_hash FROM accounts", [], "blocked");
  }
  await expect("signed-out visitor sees no submissions", anon, "SELECT id FROM submissions", [], "blocked");
  await expect("signed-out visitor cannot read brand rules", anon, "SELECT id FROM rules", [], "blocked");

  console.log("\nSign-in");
  const h = hashPassword("aranya-demo");
  const check = (name: string, ok: boolean) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };
  check("password is stored as a salted scrypt hash, not plain text", h.startsWith("scrypt$") && !h.includes("aranya-demo"));
  check("right password is accepted", verifyPassword("aranya-demo", h));
  check("wrong password is rejected", !verifyPassword("aranya-demo2", h));
  const tok = signSession("u_rahul", "creator");
  check("valid session cookie is accepted", verifySession(tok)?.uid === "u_rahul");
  const [body, sig] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), role: "admin" })).toString("base64url") + "." + sig;
  check("cookie edited to say 'admin' is rejected", verifySession(forged) === null);
  check("garbage cookie is rejected", verifySession("abc.def") === null && verifySession("") === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
