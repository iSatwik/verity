import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { findingsFor, getSubmission, hasUncheckedChanges, approvalsFor, requiredApprovers } from "@/lib/store";
import { getUser } from "@/lib/users";
import { Workspace, type WorkspaceData } from "@/components/Workspace";
import type { ImageReport, Intent } from "@/lib/check/types";

export const maxDuration = 60;

export default async function SubmissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ checked?: string }> }) {
  const { id: idStr } = await params;
  const sp = await searchParams;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();
  const sub = await getSubmission(q, id);
  if (!sub) notFound();
  const me = await currentUser();
  const n = Number(sub.current_version);
  const [findings, checkRows, versions, approvals, comments, activity, aiCalls, unchecked, canonMeta] = await Promise.all([
    findingsFor(q, id, n),
    q<{ duration_ms: number; ai_used: boolean; ai_model: string | null; redactions: number; intent: Intent | string; image_report: ImageReport | string | null; notes: string[] | string; created_at: string }>("SELECT * FROM checks WHERE submission_id = $1 AND version_n = $2 ORDER BY id DESC LIMIT 1", [id, n]),
    q<{ n: number; text: string; image_text: string | null; image_alt: string | null; canon_version: number; created_by: string; created_at: string }>("SELECT n, text, image_text, image_alt, canon_version, created_by, created_at FROM versions WHERE submission_id = $1 ORDER BY n", [id]),
    approvalsFor(q, id, n),
    q<{ id: number; author_id: string; body: string; quote: string | null; created_at: string }>("SELECT * FROM comments WHERE submission_id = $1 ORDER BY id", [id]),
    q<{ id: number; actor_id: string; action: string; detail: Record<string, unknown> | string; created_at: string }>("SELECT * FROM audit_events WHERE submission_id = $1 ORDER BY id DESC LIMIT 60", [id]),
    q<{ id: number; purpose: string; model: string; redacted_input: string | null; ok: boolean; latency_ms: number; error: string | null; created_at: string }>("SELECT * FROM ai_calls WHERE submission_id = $1 ORDER BY id DESC LIMIT 20", [id]),
    hasUncheckedChanges(q, sub),
    q<{ value: string }>("SELECT value FROM canon_meta WHERE key = 'version'"),
  ]);
  const parse = <T,>(v: T | string | null): T | null => (typeof v === "string" ? (JSON.parse(v) as T) : v);
  const check = checkRows[0];
  const data: WorkspaceData = {
    me: { id: me.id, role: me.role, name: me.name },
    sub: {
      id: sub.id, title: sub.title, channel: sub.channel, status: sub.status, risk_tier: sub.risk_tier,
      author: getUser(sub.author_id), draft_text: sub.draft_text, image_data: sub.image_data, image_alt: sub.image_alt, image_text: sub.image_text,
      current_version: n, review_record: parse(sub.review_record),
    },
    findings: findings.map((f) => ({ ...f })),
    check: check ? { duration_ms: check.duration_ms, ai_used: check.ai_used, ai_model: check.ai_model, redactions: check.redactions, intent: parse<Intent>(check.intent), image_report: parse<ImageReport>(check.image_report), notes: parse<string[]>(check.notes) ?? [], created_at: String(check.created_at) } : null,
    versions: versions.map((v) => ({ ...v, created_at: String(v.created_at), author: getUser(v.created_by).name })),
    approvals: approvals.map((a) => ({ ...a, created_at: String(a.created_at), name: getUser(a.approver_id).name })),
    required: requiredApprovers(sub),
    comments: comments.map((c) => ({ ...c, created_at: String(c.created_at), author: getUser(c.author_id) })),
    activity: activity.map((a) => ({ ...a, created_at: String(a.created_at), detail: parse<Record<string, unknown>>(a.detail) ?? {}, actor: getUser(a.actor_id).name })),
    aiCalls: aiCalls.map((a) => ({ ...a, created_at: String(a.created_at) })),
    unchecked,
    justChecked: sp.checked === "1",
    canonVersion: Number(canonMeta[0]?.value ?? 1),
  };
  return <Workspace data={data} />;
}
