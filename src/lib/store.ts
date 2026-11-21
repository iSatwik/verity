// Submissions, versions, findings, decisions, approvals, comments and the audit log.
// Every function takes a query function so the seeder and the app share the same code.

import { applyFalseAlarms, normQuote } from "./rule-health";
import { createHash } from "node:crypto";
import { loadCanonWith, type Canon } from "./canon";
import { runPipeline, riskTier } from "./check";
import type { Finding } from "./check/types";
import { getUser, type DemoUser } from "./users";

export type Q = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export interface SubmissionRow {
  id: number; title: string; channel: string; author_id: string; status: string; risk_tier: string;
  draft_text: string; image_data: string | null; image_alt: string | null; image_text: string | null;
  current_version: number; review_record: ReviewRecord | null; created_at: string; updated_at: string;
}
export interface ReviewRecord { version: number; hash: string; canon_version: number; approvers: { id: string; name: string; role: string; decision: string; note: string | null; at: string }[]; approved_at: string }
export interface FindingRow {
  id: number; submission_id: number; version_n: number; location: "text" | "image"; category: string; severity: string; title: string; message: string;
  quote: string | null; suggestion: string | null; sources: { id: string; kind: string; text: string }[]; method: string; status: string; decision_reason: string | null; decided_by: string | null;
}

export { STATUS_LABEL } from "./labels";

export async function audit(q: Q, actor: string, action: string, submissionId: number | null, detail: Record<string, unknown> = {}) {
  await q("INSERT INTO audit_events (actor_id, action, submission_id, detail) VALUES ($1, $2, $3, $4::jsonb)", [actor, action, submissionId, JSON.stringify(detail)]);
}

export async function getSubmission(q: Q, id: number): Promise<SubmissionRow | undefined> {
  return (await q<SubmissionRow>("SELECT * FROM submissions WHERE id = $1", [id]))[0];
}

export async function createSubmission(q: Q, actor: DemoUser, input: { title: string; channel: string; text: string; imageData?: string | null; imageAlt?: string | null; imageText?: string | null }): Promise<number> {
  const rows = await q<{ id: number }>(
    "INSERT INTO submissions (title, channel, author_id, draft_text, image_data, image_alt, image_text) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [input.title.trim() || "Untitled", input.channel, actor.id, input.text ?? "", input.imageData || null, input.imageAlt ?? null, input.imageText ?? null],
  );
  const id = Number(rows[0].id);
  await audit(q, actor.id, "submission.created", id, { title: input.title, channel: input.channel, hasImage: Boolean(input.imageData) });
  return id;
}

/** Snapshot the draft as a new version, run every check, store findings. */
export async function runCheckFor(q: Q, id: number, actor: DemoUser, opts: { ai?: boolean } = {}): Promise<void> {
  const sub = await getSubmission(q, id);
  if (!sub) throw new Error("Submission not found");
  if (sub.status === "approved") throw new Error("This version is approved and locked. Reopen it to make changes.");
  const canon: Canon = await loadCanonWith(q);
  const n = Number(sub.current_version) + 1;
  const t0 = Date.now();
  const logs: Parameters<Parameters<typeof runPipeline>[2] & object>[0][] = [];
  const result = await runPipeline(canon, { text: sub.draft_text, channel: sub.channel, imageData: sub.image_data, imageAlt: sub.image_alt, imageText: sub.image_text }, (l) => logs.push(l), opts);
  const ms = Date.now() - t0;

  // If the AI read the text inside the image, keep it so the creator can edit it.
  let imageText = sub.image_text;
  if (result.detectedImageText && !imageText) imageText = result.detectedImageText;

  await q("INSERT INTO versions (submission_id, n, text, image_alt, image_text, canon_version, created_by, image_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [id, n, sub.draft_text, sub.image_alt, imageText, canon.version, actor.id, imgHash(sub.image_data)]);

  // Rule health: warnings already marked as false alarms (same rule, same wording) are not raised again.
  const alarms = await q<{ rule_id: string; quote_norm: string }>("SELECT rule_id, quote_norm FROM false_alarms");
  const { kept, hidden } = applyFalseAlarms(result.findings, alarms);
  result.findings = kept;
  if (hidden.length) result.notes.push(`${hidden.length} warning${hidden.length > 1 ? "s were" : " was"} not shown because ${hidden.length > 1 ? "they were" : "it was"} marked as a false alarm before (see Rule health).`);

  // Earlier decisions carry over when the same issue appears again (so nobody has to dismiss twice).
  const previous = await q<FindingRow>("SELECT * FROM findings WHERE submission_id = $1 AND version_n = $2 AND status IN ('dismissed','exception_requested')", [id, n - 1]);
  for (const f of result.findings) {
    if (f.sources?.[0]?.id) await feedback(q, f.sources[0].id, "flagged", f.quote ?? null, null, id, actor.id);
    const prev = previous.find((p) => p.title === f.title && (p.quote ?? "") === (f.quote ?? "") && p.location === f.location);
    await insertFinding(q, id, n, f, prev ? { status: prev.status, reason: prev.decision_reason, by: prev.decided_by } : undefined);
  }
  await q("INSERT INTO checks (submission_id, version_n, duration_ms, ai_used, ai_model, redactions, intent, image_report, notes) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)", [
    id, n, ms, result.aiUsed, result.aiModel, result.redactions, JSON.stringify(result.intent), JSON.stringify(result.imageReport), JSON.stringify(result.notes),
  ]);
  for (const l of logs) {
    await q("INSERT INTO ai_calls (submission_id, purpose, model, redacted_input, ok, latency_ms, error) VALUES ($1,$2,$3,$4,$5,$6,$7)", [id, l.purpose, l.model, l.redacted_input, l.ok, l.latency_ms, l.error ?? null]);
  }
  const tier = riskTier(result.findings, sub.channel);
  const status = await computeStatus(q, id, n);
  await q("UPDATE submissions SET current_version = $2, status = $3, risk_tier = CASE WHEN risk_tier = 'claims' THEN 'claims' ELSE $4 END, image_text = $5, updated_at = now() WHERE id = $1", [id, n, status, tier, imageText]);
  const counts = countBy(result.findings);
  await audit(q, actor.id, "check.ran", id, { version: n, ms, ai: result.aiModel, canon_version: canon.version, ...counts });
}

function imgHash(d: string | null): string {
  return d ? createHash("sha256").update(d).digest("hex").slice(0, 16) : "";
}

function countBy(fs: Finding[]) {
  const c = { blocker: 0, major: 0, minor: 0, advisory: 0 };
  for (const f of fs) c[f.severity] += 1;
  return c;
}

async function insertFinding(q: Q, id: number, n: number, f: Finding, carry?: { status: string; reason: string | null; by: string | null }) {
  await q(
    "INSERT INTO findings (submission_id, version_n, location, category, severity, title, message, quote, suggestion, sources, method, status, decision_reason, decided_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14)",
    [id, n, f.location, f.category, f.severity, f.title, f.message, f.quote ?? null, f.suggestion ?? null, JSON.stringify(f.sources), f.method, carry?.status ?? "open", carry ? (/\(carried over from an earlier version\)$/.test(carry.reason ?? "") ? carry.reason : `${(carry.reason ?? "").replace(/( \(carried over from the previous version\))+$/, "")} (carried over from an earlier version)`) : null, carry?.by ?? null],
  );
}

/** Open blockers/majors keep a submission in "needs fixes". */
async function computeStatus(q: Q, id: number, n: number): Promise<string> {
  const open = await q<{ severity: string; status: string }>("SELECT severity, status FROM findings WHERE submission_id = $1 AND version_n = $2", [id, n]);
  const blocking = open.some((f) => f.status === "open" && (f.severity === "blocker" || f.severity === "major"));
  return blocking ? "needs_fixes" : "ready";
}

export async function findingsFor(q: Q, id: number, n: number): Promise<FindingRow[]> {
  const rows = await q<FindingRow>("SELECT * FROM findings WHERE submission_id = $1 AND version_n = $2 ORDER BY CASE severity WHEN 'blocker' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END, location DESC, id", [id, n]);
  return rows.map((r) => ({ ...r, sources: typeof r.sources === "string" ? JSON.parse(r.sources) : r.sources }));
}

async function finding(q: Q, fid: number): Promise<FindingRow> {
  const f = (await q<FindingRow>("SELECT * FROM findings WHERE id = $1", [fid]))[0];
  if (!f) throw new Error("Finding not found");
  return f;
}

function assertEditable(sub: SubmissionRow, actor: DemoUser) {
  if (sub.status === "approved") throw new Error("Approved content is locked. Reopen it to make changes.");
  if (sub.status === "in_review") throw new Error("This is in review. Wait for the reviewer, or ask them to request changes.");
  if (actor.role !== "creator" && actor.role !== "admin" && actor.id !== sub.author_id) throw new Error("Only the creator can change the content.");
}

/** Apply a suggested fix (optionally edited by the creator) to the working draft. */
export async function acceptFix(q: Q, fid: number, actor: DemoUser, edited?: string | null): Promise<void> {
  const f = await finding(q, fid);
  const sub = (await getSubmission(q, f.submission_id))!;
  assertEditable(sub, actor);
  const replacement = edited ?? f.suggestion;
  if (replacement === null || replacement === undefined) throw new Error("This finding has no automatic fix. Edit the text yourself.");
  if (f.location === "image" && f.title !== "Missing alt text") throw new Error("This is in the picture itself. Replace the image with a corrected design instead.");
  if (f.location === "image" && f.title === "Missing alt text") {
    await q("UPDATE submissions SET image_alt = $2, updated_at = now() WHERE id = $1", [sub.id, replacement]);
  } else if (f.location === "image" && f.category === "visual") {
    // Visual fixes are made by the designer; record the decision.
  } else {
    const field = f.location === "image" ? "image_text" : "draft_text";
    const current = (f.location === "image" ? sub.image_text : sub.draft_text) ?? "";
    if (!f.quote || !current.includes(f.quote)) throw new Error("That text has already changed. Run the check again to refresh the findings.");
    const next = current.replace(f.quote, replacement).replace(/ {2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
    await q(`UPDATE submissions SET ${field} = $2, updated_at = now() WHERE id = $1`, [sub.id, next]);
    // Other findings whose text disappeared are resolved by this edit.
    const others = await q<FindingRow>("SELECT * FROM findings WHERE submission_id = $1 AND version_n = $2 AND status = 'open' AND location = $3 AND id <> $4", [sub.id, f.version_n, f.location, f.id]);
    for (const o of others) if (o.quote && !next.includes(o.quote)) await q("UPDATE findings SET status = 'resolved', decided_by = $2, decision_reason = 'Fixed by another change' WHERE id = $1", [o.id, actor.id]);
  }
  await q("UPDATE findings SET status = 'accepted', decided_by = $2, decision_reason = $3 WHERE id = $1", [fid, actor.id, edited && edited !== f.suggestion ? "Accepted with edits" : "Accepted suggested fix"]);
  if (f.sources?.[0]?.id) await feedback(q, f.sources[0].id, "accepted", f.quote ?? null, replacement, sub.id, actor.id);
  await audit(q, actor.id, "finding.accepted", sub.id, { finding: f.id, title: f.title, rule: f.sources?.[0]?.id, from: f.quote, to: replacement });
}

export { DISMISS_REASONS } from "./labels";

export async function dismissFinding(q: Q, fid: number, actor: DemoUser, reason: string, note: string): Promise<void> {
  const f = await finding(q, fid);
  const sub = (await getSubmission(q, f.submission_id))!;
  assertEditable(sub, actor);
  if (!reason) throw new Error("Pick a reason.");
  const full = `${reason}${note ? `: ${note}` : ""}`;
  const status = f.severity === "blocker" ? "exception_requested" : "dismissed";
  if (f.severity === "blocker" && !note.trim()) throw new Error("Must-fix issues need a written explanation. A reviewer has to approve the exception.");
  await q("UPDATE findings SET status = $2, decided_by = $3, decision_reason = $4 WHERE id = $1", [fid, status, actor.id, full]);
  const rule = f.sources?.[0]?.id;
  if (rule) {
    const kind = status === "exception_requested" ? "exception" : reason === "False positive" ? "false_positive" : reason === "Rule is unclear" ? "unclear" : "dismissed";
    await feedback(q, rule, kind, f.quote ?? null, note || null, sub.id, actor.id);
    // remember the false alarm so the same wording is not flagged again for this rule
    if (kind === "false_positive" && f.quote) await q("INSERT INTO false_alarms (rule_id, quote_norm, quote, created_by) VALUES ($1,$2,$3,$4) ON CONFLICT (rule_id, quote_norm) DO NOTHING", [rule, normQuote(f.quote), f.quote, actor.id]);
  }
  await audit(q, actor.id, status === "dismissed" ? "finding.dismissed" : "finding.exception_requested", sub.id, { finding: f.id, title: f.title, rule: f.sources?.[0]?.id, reason: full });
  await refreshStatus(q, sub.id);
}

export async function reopenFinding(q: Q, fid: number, actor: DemoUser): Promise<void> {
  const f = await finding(q, fid);
  const sub = (await getSubmission(q, f.submission_id))!;
  assertEditable(sub, actor);
  await q("UPDATE findings SET status = 'open', decided_by = NULL, decision_reason = NULL WHERE id = $1", [fid]);
  await refreshStatus(q, sub.id);
}

async function refreshStatus(q: Q, id: number) {
  const sub = (await getSubmission(q, id))!;
  if (["in_review", "approved"].includes(sub.status)) return;
  const s = await computeStatus(q, id, sub.current_version);
  await q("UPDATE submissions SET status = $2 WHERE id = $1", [id, sub.status === "changes_requested" && s === "needs_fixes" ? "changes_requested" : s]);
}

/** What the editor showed when it was opened. Used so a save never overwrites changes made meanwhile (e.g. accepted fixes). */
export interface DraftBase { text: string; imageAlt: string; imageText: string }

export async function updateDraft(q: Q, id: number, actor: DemoUser, input: { text: string; imageAlt?: string | null; imageText?: string | null; title?: string; imageData?: string | null; base?: DraftBase }) {
  const sub = (await getSubmission(q, id))!;
  assertEditable(sub, actor);
  const imageData = input.imageData === undefined ? sub.image_data : input.imageData || null;
  // Fields the person did not touch keep the current value. If they changed the caption and it also changed on the server, refuse (no silent overwrite).
  const merge = (neu: string | null | undefined, cur: string | null, base: string | undefined, strict = false): string | null => {
    if (neu === undefined || neu === null) return cur;
    if (base === undefined) return neu;
    if (neu === base) return cur;
    if (strict && (cur ?? "") !== base) throw new Error("This post changed while you were editing (for example, fixes were accepted). Your edit was not saved. Close the editor, open Edit again and redo your change.");
    return neu;
  };
  const text = merge(input.text, sub.draft_text, input.base?.text, true) ?? "";
  const alt = merge(input.imageAlt, sub.image_alt, input.base?.imageAlt);
  const imgText = merge(input.imageText, sub.image_text, input.base?.imageText);
  await q("UPDATE submissions SET draft_text = $2, image_alt = $3, image_text = $4, title = COALESCE($5, title), image_data = $6, updated_at = now() WHERE id = $1", [id, text, alt, imgText, input.title ?? null, imageData]);
  await audit(q, actor.id, "draft.edited", id, { imageReplaced: input.imageData !== undefined && input.imageData !== sub.image_data });
}

export async function hasUncheckedChanges(q: Q, sub: SubmissionRow): Promise<boolean> {
  if (!sub.current_version) return true;
  const v = (await q<{ text: string; image_alt: string | null; image_text: string | null; image_hash: string | null }>("SELECT text, image_alt, image_text, image_hash FROM versions WHERE submission_id = $1 AND n = $2", [sub.id, sub.current_version]))[0];
  if (!v) return true;
  return (v.image_hash ?? "") !== imgHash(sub.image_data) || v.text !== sub.draft_text || (v.image_alt ?? "") !== (sub.image_alt ?? "") || (v.image_text ?? "") !== (sub.image_text ?? "");
}

export function requiredApprovers(sub: SubmissionRow): ("manager" | "compliance")[] {
  return sub.risk_tier === "claims" ? ["manager", "compliance"] : ["manager"];
}

export async function submitForReview(q: Q, id: number, actor: DemoUser) {
  const sub = (await getSubmission(q, id))!;
  if (!["ready", "needs_fixes", "changes_requested", "draft"].includes(sub.status)) throw new Error("This can't be submitted right now.");
  if (await hasUncheckedChanges(q, sub)) throw new Error("You have changes that haven't been checked. Run the check first.");
  const fs = await findingsFor(q, id, sub.current_version);
  const open = fs.filter((f) => f.status === "open" && (f.severity === "blocker" || f.severity === "major"));
  if (open.length) throw new Error(`${open.length} must-fix or should-fix issue(s) still open. Fix them, or dismiss with a reason.`);
  await q("UPDATE submissions SET status = 'in_review', updated_at = now() WHERE id = $1", [id]);
  await audit(q, actor.id, "submitted", id, { version: sub.current_version, route: requiredApprovers(sub) });
}

export async function approvalsFor(q: Q, id: number, n: number) {
  return q<{ id: number; approver_id: string; role: string; decision: string; note: string | null; created_at: string; version_n: number }>(
    "SELECT * FROM approvals WHERE submission_id = $1 AND version_n = $2 ORDER BY id", [id, n]);
}

export async function reviewDecision(q: Q, id: number, actor: DemoUser, decision: "approved" | "changes_requested" | "exception", note: string) {
  const sub = (await getSubmission(q, id))!;
  if (sub.status !== "in_review") throw new Error("This submission is not waiting for review.");
  const needed = requiredApprovers(sub);
  const actsAs = actor.role === "admin" ? "manager" : actor.role;
  if (!needed.includes(actsAs as "manager" | "compliance")) throw new Error(actor.role === "compliance" ? "Compliance only reviews content with claims. This one only needs the brand manager." : "Your role can't approve content.");
  const fs = await findingsFor(q, id, sub.current_version);
  const exceptions = fs.filter((f) => f.status === "exception_requested");
  if (decision === "approved" && exceptions.length) throw new Error(`There ${exceptions.length === 1 ? "is 1 must-fix issue" : `are ${exceptions.length} must-fix issues`} with an exception request. Use "Approve with exception" and write why.`);
  if ((decision === "exception" || decision === "changes_requested") && !note.trim()) throw new Error("Please write a short note explaining your decision.");
  await q("INSERT INTO approvals (submission_id, version_n, approver_id, role, decision, note) VALUES ($1,$2,$3,$4,$5,$6)", [id, sub.current_version, actor.id, actsAs, decision, note || null]);
  await audit(q, actor.id, `review.${decision}`, id, { version: sub.current_version, note });
  if (decision === "changes_requested") {
    await q("UPDATE submissions SET status = 'changes_requested', updated_at = now() WHERE id = $1", [id]);
    return;
  }
  const approvals = await approvalsFor(q, id, sub.current_version);
  const done = needed.every((role) => approvals.some((a) => a.role === role && a.decision !== "changes_requested"));
  if (done) {
    const v = (await q<{ text: string; image_text: string | null; image_alt: string | null; canon_version: number }>("SELECT * FROM versions WHERE submission_id = $1 AND n = $2", [id, sub.current_version]))[0];
    const hash = createHash("sha256").update(`${v.text}\n${v.image_text ?? ""}\n${v.image_alt ?? ""}\n${sub.image_data ? createHash("sha256").update(sub.image_data).digest("hex") : ""}`).digest("hex");
    const record: ReviewRecord = {
      version: sub.current_version,
      hash,
      canon_version: Number(v.canon_version),
      approvers: approvals.filter((a) => a.decision !== "changes_requested").map((a) => ({ id: a.approver_id, name: getUser(a.approver_id).name, role: a.role, decision: a.decision, note: a.note, at: new Date(a.created_at).toISOString() })),
      approved_at: new Date().toISOString(),
    };
    await q("UPDATE submissions SET status = 'approved', review_record = $2::jsonb, updated_at = now() WHERE id = $1", [id, JSON.stringify(record)]);
    await audit(q, actor.id, "approved.locked", id, { version: sub.current_version, hash });
  }
}

export async function reopen(q: Q, id: number, actor: DemoUser) {
  const sub = (await getSubmission(q, id))!;
  if (sub.status !== "approved" && sub.status !== "in_review") return;
  await q("UPDATE submissions SET status = 'needs_fixes', review_record = NULL, updated_at = now() WHERE id = $1", [id]);
  await audit(q, actor.id, "reopened", id, { previous: sub.status });
  await refreshStatus(q, id);
}

export async function addComment(q: Q, id: number, actor: DemoUser, body: string, quote?: string | null) {
  if (!body.trim()) throw new Error("Write a comment first.");
  await q("INSERT INTO comments (submission_id, author_id, body, quote) VALUES ($1,$2,$3,$4)", [id, actor.id, body.trim(), quote?.trim() || null]);
  await audit(q, actor.id, "comment.added", id, { quote: quote ?? null });
}

async function feedback(q: Q, rule: string, kind: string, quote: string | null, note: string | null, sub: number | null, user: string | null) {
  await q("INSERT INTO rule_feedback (rule_id, kind, quote, note, submission_id, user_id) VALUES ($1,$2,$3,$4,$5,$6)", [rule, kind, quote, note, sub, user]);
}
