"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { diffWords } from "diff";
import {
  acceptAllAction, acceptFixAction, commentAction, dismissAction, reopenAction, reopenFindingAction,
  reviewAction, runCheckAction, saveDraftAction, submitAction,
} from "@/app/actions";
import { DISMISS_REASONS, CHANNELS } from "@/lib/labels";
import type { DemoUser } from "@/lib/users";
import type { ImageReport, Intent } from "@/lib/check/types";
import { ActionButton } from "./ActionButton";
import { Avatar, Card, ChannelTag, Label, SeverityBadge, StatusPill, TimeAgo } from "./ui";

export interface WFinding {
  id: number; version_n: number; location: "text" | "image"; category: string; severity: string; title: string; message: string;
  quote: string | null; suggestion: string | null; sources: { id: string; kind: string; text: string }[]; method: string; status: string; decision_reason: string | null; decided_by: string | null;
}
export interface WorkspaceData {
  me: { id: string; role: string; name: string };
  sub: { id: number; title: string; channel: string; status: string; risk_tier: string; author: DemoUser; draft_text: string; image_data: string | null; image_alt: string | null; image_text: string | null; current_version: number;
    review_record: { version: number; hash: string; canon_version: number; approvers: { id: string; name: string; role: string; decision: string; note: string | null; at: string }[]; approved_at: string } | null };
  findings: WFinding[];
  check: { duration_ms: number; ai_used: boolean; ai_model: string | null; redactions: number; intent: Intent | null; image_report: ImageReport | null; notes: string[]; created_at: string } | null;
  versions: { n: number; text: string; image_text: string | null; image_alt: string | null; canon_version: number; created_by: string; created_at: string; author: string }[];
  approvals: { id: number; approver_id: string; role: string; decision: string; note: string | null; created_at: string; name: string }[];
  required: ("manager" | "compliance")[];
  comments: { id: number; author: DemoUser; body: string; quote: string | null; created_at: string }[];
  activity: { id: number; actor: string; action: string; detail: Record<string, unknown>; created_at: string }[];
  aiCalls: { id: number; purpose: string; model: string; redacted_input: string | null; ok: boolean; latency_ms: number; error: string | null; created_at: string }[];
  unchecked: boolean;
  justChecked: boolean;
  canonVersion: number;
}

const ROLE_PERSON: Record<string, string> = { manager: "Ritika S. (Brand manager)", compliance: "Arjun V. (Compliance)" };
const OPEN = (f: WFinding) => f.status === "open";

function highlightSegments(text: string, findings: WFinding[]) {
  const order = { blocker: 0, major: 1, minor: 2, advisory: 3 } as Record<string, number>;
  const ranges: { start: number; end: number; f: WFinding }[] = [];
  const sorted = [...findings].filter((f) => f.location === "text" && f.quote && ["open", "exception_requested", "dismissed"].includes(f.status)).sort((a, b) => order[a.severity] - order[b.severity]);
  for (const f of sorted) {
    let from = 0;
    while (true) {
      const i = text.indexOf(f.quote!, from);
      if (i < 0) break;
      const r = { start: i, end: i + f.quote!.length, f };
      if (!ranges.some((x) => r.start < x.end && r.end > x.start)) { ranges.push(r); break; }
      from = i + 1;
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const out: { text: string; f?: WFinding }[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) });
    out.push({ text: text.slice(r.start, r.end), f: r.f });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

async function fileToDataUrl(file: Blob, maxSide = 1200): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  } finally { URL.revokeObjectURL(url); }
}

function flash(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}

export function Workspace({ data }: { data: WorkspaceData }) {
  const { sub, me, findings, check } = data;
  const isCreatorSide = me.role === "creator" || me.role === "admin" || me.id === sub.author.id;
  const editable = isCreatorSide && !["in_review", "approved"].includes(sub.status);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sub.draft_text);
  const [alt, setAlt] = useState(sub.image_alt ?? "");
  const [imgText, setImgText] = useState(sub.image_text ?? "");
  const [newImage, setNewImage] = useState<string | undefined>(undefined);
  const [quote, setQuote] = useState<string>("");
  const [tab, setTab] = useState<"comments" | "versions" | "activity" | "ai">("comments");

  const open = findings.filter(OPEN);
  const blockingOpen = open.filter((f) => f.severity === "blocker" || f.severity === "major");
  const exceptions = findings.filter((f) => f.status === "exception_requested");
  const fixable = open.filter((f) => f.suggestion !== null && f.method !== "ai_unverified" && f.category !== "visual");
  const segments = useMemo(() => highlightSegments(sub.draft_text, findings), [sub.draft_text, findings]);
  const counts = (sev: string) => open.filter((f) => f.severity === sev).length;

  const stepIdx = sub.status === "approved" ? 4 : sub.status === "in_review" ? 3 : sub.current_version === 0 ? 0 : blockingOpen.length === 0 && !data.unchecked ? 2 : 1;
  const steps = ["Draft", "Checked", "Issues resolved", "In review", "Approved & locked"];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/submissions" className="text-xs text-gray-500 hover:underline">← Submissions</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{sub.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <StatusPill status={sub.status} />
            <ChannelTag channel={sub.channel} />
            <span>#{sub.id} · version {sub.current_version}</span>
            <span className="flex items-center gap-1.5">· <Avatar initials={sub.author.initials} color={sub.author.color} size={20} /> {sub.author.name} ({sub.author.team})</span>
            {check && <span>· checked <TimeAgo date={check.created_at} /> in {(check.duration_ms / 1000).toFixed(1)} s against Brand Canon v{data.versions.find((v) => v.n === sub.current_version)?.canon_version ?? data.canonVersion}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && !editing && <button onClick={() => { setDraft(sub.draft_text); setAlt(sub.image_alt ?? ""); setImgText(sub.image_text ?? ""); setNewImage(undefined); setEditing(true); }} className="h-9 rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-medium hover:bg-gray-50">Edit content</button>}
          {editable && <ActionButton action={() => runCheckAction(sub.id)} variant={data.unchecked ? "primary" : "secondary"}>Run check again</ActionButton>}
        </div>
      </div>

      {/* Stepper */}
      <ol className="grid grid-cols-5 gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-lg border px-3 py-2 ${i < stepIdx ? "border-brand-200 bg-brand-50 text-brand-700" : i === stepIdx ? "border-brand-500 bg-white font-semibold text-gray-900" : "border-gray-200 bg-white text-gray-400"}`}>
            <span className="mr-1">{i < stepIdx ? "✓" : `${i + 1}.`}</span>{s}
          </li>
        ))}
      </ol>

      <Banner data={data} blockingOpen={blockingOpen.length} exceptions={exceptions.length} isCreatorSide={isCreatorSide} />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <Label>{CHANNELS[sub.channel] ?? "Content"} · text</Label>
              {!editing && <span className="text-[11px] text-gray-400">Click a highlight to see its finding · select text to comment on it</span>}
            </div>
            {editing ? (
              <div className="space-y-3">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} className="w-full rounded-lg border border-gray-300 p-3 leading-relaxed" />
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {(newImage ?? sub.image_data) && <img src={(newImage ?? sub.image_data)!} alt="Current creative" className="h-20 w-20 rounded-md border border-gray-200 object-cover" />}
                    <div className="flex flex-wrap gap-2 text-sm">
                      <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
                        {sub.image_data || newImage ? "Replace image" : "Add image"}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setNewImage(await fileToDataUrl(f)); }} />
                      </label>
                      {sub.image_data && sub.title === "Neem cleanser launch post" && (
                        <button type="button" onClick={async () => {
                          const blob = await (await fetch("/samples/creative-s01-fixed.jpg")).blob();
                          setNewImage(await fileToDataUrl(blob));
                          setImgText("Clearer skin, naturally. See visibly fewer blemishes in 4 weeks of regular use. ₹349");
                          setAlt("Neem Purifying Cleanser bottle on a forest-green background with the text: Clearer skin, naturally. See visibly fewer blemishes in 4 weeks of regular use. ₹349");
                        }} className="rounded-lg border border-dashed border-brand-500 px-3 py-1.5 text-brand-700 hover:bg-brand-50">Use the designer&apos;s on-brand version (demo)</button>
                      )}
                      {(newImage ?? sub.image_data) && <button type="button" onClick={() => setNewImage("")} className="rounded-lg px-2 py-1.5 text-gray-500 hover:bg-gray-100">Remove image</button>}
                    </div>
                  </div>
                  {(newImage ?? sub.image_data) && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm"><span className="font-medium">Alt text</span><input value={alt} onChange={(e) => setAlt(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
                      <label className="text-sm"><span className="font-medium">Text in the image</span><input value={imgText} onChange={(e) => setImgText(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <ActionButton variant="primary" action={() => saveDraftAction(sub.id, draft, alt, imgText, newImage)} onDone={(r) => { if (r.ok) { setEditing(false); setNewImage(undefined); } }}>Save changes</ActionButton>
                  <button onClick={() => { setEditing(false); setDraft(sub.draft_text); setNewImage(undefined); }} className="h-9 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            ) : (
              <div
                className="whitespace-pre-wrap text-[16px] leading-[2] text-gray-900"
                onMouseUp={() => { const s = window.getSelection()?.toString().trim(); if (s && s.length > 2) { setQuote(s.slice(0, 200)); setTab("comments"); } }}
              >
                {sub.draft_text ? segments.map((seg, i) => seg.f ? (
                  <mark key={i} id={`m-${seg.f.id}`} onClick={() => flash(`f-${seg.f!.id}`)} title={`${seg.f.title} (${seg.f.sources.map((s) => s.id).join(", ")})`} className={`hl ${seg.f.status === "open" ? `hl-${seg.f.severity}` : "hl-done"}`}>{seg.text}</mark>
                ) : <span key={i}>{seg.text}</span>) : <span className="text-gray-400">No text. Only the image is checked.</span>}
              </div>
            )}
          </Card>

          {sub.image_data && <ImagePanel data={data} />}

          {check?.intent && (
            <Card className="p-5">
              <Label>Intent card {check.intent.by === "ai" ? "· written by AI" : "· automatic summary"}</Label>
              <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
                <dt className="text-gray-500">Goal</dt><dd>{check.intent.goal}</dd>
                <dt className="text-gray-500">Audience</dt><dd>{check.intent.audience}</dd>
                <dt className="text-gray-500">Key message</dt><dd>{check.intent.key_message || "—"}</dd>
                <dt className="text-gray-500">Call to action</dt><dd>{check.intent.cta || "—"}</dd>
              </dl>
              <p className="mt-3 text-xs text-gray-500">Suggested fixes are small edits meant to keep this intent. You decide on each one.</p>
            </Card>
          )}

          <Card>
            <div className="flex gap-1 border-b border-gray-200 px-3 pt-2 text-sm">
              {([["comments", `Comments (${data.comments.length})`], ["versions", `Versions (${data.versions.length})`], ["activity", "Activity"], ["ai", "AI use"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-t-md px-3 py-2 ${tab === k ? "border-b-2 border-brand-500 font-semibold text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>{l}</button>
              ))}
            </div>
            <div className="p-5">
              {tab === "comments" && <Comments data={data} quote={quote} setQuote={setQuote} />}
              {tab === "versions" && <Versions data={data} />}
              {tab === "activity" && <Activity data={data} />}
              {tab === "ai" && <AiUse data={data} />}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <ReviewPanel data={data} blockingOpen={blockingOpen.length} exceptions={exceptions} isCreatorSide={isCreatorSide} />

          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Findings</span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{counts("blocker")} blocker</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">{counts("major")} major</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{counts("minor")} minor</span>
              {counts("advisory") > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{counts("advisory")} advisory</span>}
              <span className="text-xs text-gray-400">open</span>
              {editable && fixable.length > 1 && (
                <span className="ml-auto"><ActionButton small variant="primary" action={() => acceptAllAction(sub.id)}>Accept all {fixable.length} suggested fixes</ActionButton></span>
              )}
            </div>
            {sub.current_version === 0 && <p className="mt-3 text-sm text-gray-500">Not checked yet.</p>}
            {sub.current_version > 0 && findings.length === 0 && <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">✓ No issues found. Every claim matches an approved fact.</p>}
          </Card>

          <div className="space-y-3">
            {findings.map((f) => <FindingCard key={f.id} f={f} subId={sub.id} editable={editable} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Banner({ data, blockingOpen, exceptions, isCreatorSide }: { data: WorkspaceData; blockingOpen: number; exceptions: number; isCreatorSide: boolean }) {
  const { sub } = data;
  const last = [...data.approvals].reverse().find((a) => a.decision === "changes_requested");
  if (data.unchecked && !["in_review", "approved"].includes(sub.status))
    return <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><b>You changed the content since the last check.</b> Click <b>Run check again</b> (top right) to check the new version.</div>;
  if (sub.status === "changes_requested" && last)
    return <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900"><b>{last.name} requested changes:</b> “{last.note}”. Edit the content, run the check again and resubmit.</div>;
  if (sub.status === "needs_fixes" && isCreatorSide)
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"><b>{blockingOpen} blocker/major issue{blockingOpen === 1 ? "" : "s"} to resolve before you can submit.</b> Accept a fix, edit the text yourself, or dismiss with a reason. Blockers can only be dismissed as an <i>exception request</i> that a reviewer must approve.</div>;
  if (sub.status === "ready" && isCreatorSide)
    return <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><b>Ready to submit.</b> {exceptions ? `${exceptions} exception request(s) will go to the reviewers. ` : ""}Use <b>Submit for review</b> on the right.</div>;
  if (sub.status === "approved" && data.justChecked === false) return null;
  return null;
}

function FindingCard({ f, subId, editable }: { f: WFinding; subId: number; editable: boolean }) {
  const [mode, setMode] = useState<"none" | "edit" | "dismiss">("none");
  const [edited, setEdited] = useState(f.suggestion ?? "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const decided = f.status !== "open";
  const methodLabel = f.method === "code" ? "Checked by code" : f.method === "ai" ? "AI · citation verified" : "AI · not verified";
  const statusLabel: Record<string, string> = { accepted: "Fixed", dismissed: "Dismissed", exception_requested: "Exception requested", resolved: "Resolved by another change" };
  const canApply = f.suggestion !== null && f.category !== "visual" && f.method !== "ai_unverified";
  return (
    <div id={`f-${f.id}`} className={`rounded-xl border bg-white p-4 transition ${decided ? "border-gray-200 opacity-70" : f.severity === "blocker" ? "border-red-200" : "border-gray-200"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={f.severity} />
        <button className="text-left text-sm font-semibold hover:underline" onClick={() => flash(`m-${f.id}`)}>{f.title}</button>
        <span className="ml-auto flex gap-1 text-[10.5px] text-gray-500">
          <span className="rounded bg-gray-100 px-1.5 py-0.5">{f.location === "image" ? "In image" : "In text"}</span>
          <span className={`rounded px-1.5 py-0.5 ${f.method === "ai_unverified" ? "bg-gray-100" : f.method === "ai" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{methodLabel}</span>
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-700">{f.message}</p>
      {f.location === "image" && f.category !== "accessibility" && f.status === "open" && <p className="mt-1 text-[11.5px] text-gray-500">This is in the image itself: update the creative, then use <b>Edit content → Replace image</b>.</p>}
      {f.quote && (
        <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-[13px]">
          <span className="text-red-700 line-through decoration-red-300">{f.quote}</span>
          {f.suggestion !== null && f.category !== "visual" && <> <span className="text-gray-400">→</span> <b className="text-brand-700">{f.suggestion === "" ? "(remove)" : f.suggestion}</b></>}
          {f.category === "visual" && f.suggestion && <> <span className="text-gray-400">→ use</span> <span className="inline-flex items-center gap-1 font-semibold"><span className="inline-block h-3 w-3 rounded-sm border" style={{ background: f.suggestion }} />{f.suggestion}</span></>}
        </div>
      )}
      {f.sources.length > 0 && (
        <div className="mt-2 space-y-1">
          {f.sources.map((s) => (
            <div key={s.id} className="flex gap-2 text-[12px] leading-snug text-gray-600">
              <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700">{s.id}</span>
              <span className="pt-0.5">{s.text}</span>
            </div>
          ))}
        </div>
      )}
      {decided && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${f.status === "accepted" || f.status === "resolved" ? "bg-brand-50 text-brand-700" : f.status === "exception_requested" ? "bg-orange-50 text-orange-700" : "bg-gray-100 text-gray-600"}`}>{statusLabel[f.status] ?? f.status}</span>
          {f.decision_reason && <span className="text-gray-500">{f.decision_reason}</span>}
          {editable && ["dismissed", "exception_requested"].includes(f.status) && <span className="ml-auto"><ActionButton small variant="ghost" action={() => reopenFindingAction(f.id, subId)}>Undo</ActionButton></span>}
        </div>
      )}
      {!decided && editable && (
        <div className="mt-3">
          {mode === "none" && (
            <div className="flex flex-wrap gap-1.5">
              {canApply && <ActionButton small variant="primary" action={() => acceptFixAction(f.id, subId)}>{f.title === "Missing alt text" ? "Use this alt text" : f.location === "image" ? "Fix image text" : "Accept fix"}</ActionButton>}
              {canApply && <button onClick={() => setMode("edit")} className="h-7 rounded-lg border border-gray-300 px-2.5 text-xs font-medium hover:bg-gray-50">Edit & accept</button>}
              <button onClick={() => setMode("dismiss")} className="h-7 rounded-lg border border-gray-300 px-2.5 text-xs font-medium hover:bg-gray-50">{f.severity === "blocker" ? "Request exception…" : "Dismiss…"}</button>
            </div>
          )}
          {mode === "edit" && (
            <div className="space-y-2">
              <textarea value={edited} onChange={(e) => setEdited(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              <div className="flex gap-1.5">
                <ActionButton small variant="primary" action={() => acceptFixAction(f.id, subId, edited)}>Apply my version</ActionButton>
                <button onClick={() => setMode("none")} className="h-7 px-2 text-xs text-gray-600">Cancel</button>
              </div>
            </div>
          )}
          {mode === "dismiss" && (
            <div className="space-y-2">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm">
                <option value="">Why? Pick a reason…</option>
                {DISMISS_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={f.severity === "blocker" ? "Explain why this should be allowed (required)" : "Note (optional)"} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              {f.severity === "blocker" && <p className="text-[11px] text-gray-500">A blocker can&apos;t just be dismissed: a reviewer has to approve the exception.</p>}
              <div className="flex gap-1.5">
                <ActionButton small variant="secondary" action={() => dismissAction(f.id, subId, reason, note)}>{f.severity === "blocker" ? "Request exception" : "Dismiss"}</ActionButton>
                <button onClick={() => setMode("none")} className="h-7 px-2 text-xs text-gray-600">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImagePanel({ data }: { data: WorkspaceData }) {
  const { sub, check } = data;
  const rep = check?.image_report;
  return (
    <Card className="p-5">
      <Label>Image · visual identity</Label>
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sub.image_data!} alt={sub.image_alt || "Uploaded creative (no alt text yet)"} className="w-full rounded-lg border border-gray-200" />
        <div className="space-y-3 text-sm">
          <div><span className="text-gray-500">Alt text: </span>{sub.image_alt ? <span>{sub.image_alt}</span> : <span className="font-medium text-amber-700">missing</span>}</div>
          <div><span className="text-gray-500">Text in image{rep?.textSource === "ai" ? " (read by AI)" : ""}: </span>{sub.image_text || <span className="text-gray-400">none</span>}</div>
          {rep && (
            <>
              <div>
                <p className="mb-1.5 text-gray-500">Main colours (ring = not a brand colour)</p>
                <div className="flex flex-wrap gap-2">
                  {rep.colours.filter((c) => c.share >= 0.02).map((c) => (
                    <span key={c.hex} title={`${c.hex} · ${Math.round(c.share * 100)}% · nearest ${c.nearest} ${c.nearestHex} (ΔE ${c.deltaE})`} className="flex items-center gap-1.5 rounded-md border border-gray-200 px-1.5 py-1 text-[11px]">
                      <span className={`h-5 w-5 rounded ${c.onBrand ? "" : "ring-2 ring-red-500 ring-offset-1"}`} style={{ background: c.hex }} />
                      <span className="font-mono">{c.hex.toUpperCase()}</span>
                      <span className="text-gray-400">{Math.round(c.share * 100)}%</span>
                    </span>
                  ))}
                </div>
              </div>
              {rep.contrast && (
                <div className="flex items-center gap-2">
                  <span className="rounded px-2 py-1 text-xs font-semibold" style={{ background: rep.contrast.bg, color: rep.contrast.fg }}>Aa sample</span>
                  <span>Estimated text contrast <b className={rep.contrast.ratio < 4.5 ? "text-red-700" : "text-brand-700"}>{rep.contrast.ratio} : 1</b> <span className="text-gray-400">(needs 4.5 : 1)</span></span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function ReviewPanel({ data, blockingOpen, exceptions, isCreatorSide }: { data: WorkspaceData; blockingOpen: number; exceptions: WFinding[]; isCreatorSide: boolean }) {
  const { sub, me, approvals, required } = data;
  const [note, setNote] = useState("");
  const myRole = me.role === "admin" ? "manager" : me.role;
  const iAmReviewer = required.includes(myRole as "manager" | "compliance");
  const alreadyMine = approvals.some((a) => a.role === myRole && a.decision !== "changes_requested");
  const rec = sub.review_record;
  return (
    <Card className={`p-4 ${sub.status === "approved" ? "border-brand-200 bg-brand-50/40" : ""}`}>
      <Label>Approval</Label>
      <div className="space-y-1.5 text-sm">
        <p className="text-xs text-gray-500">Route: {sub.risk_tier === "claims" ? "this content has claims or offers, so it needs the brand manager and compliance." : "standard content: the brand manager approves."}</p>
        {required.map((r) => {
          const a = approvals.find((x) => x.role === r && x.decision !== "changes_requested");
          return (
            <div key={r} className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${a ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-500"}`}>{a ? "✓" : "…"}</span>
              <span>{ROLE_PERSON[r]}</span>
              {a && <span className="text-xs text-gray-500">{a.decision === "exception" ? "approved with exception" : "approved"} <TimeAgo date={a.created_at} />{a.note ? ` · “${a.note}”` : ""}</span>}
            </div>
          );
        })}
      </div>

      {rec && sub.status === "approved" && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-white p-3 text-xs text-gray-700">
          <p className="mb-1 text-sm font-semibold text-brand-700">✓ Approved and locked · review record</p>
          <p>Version {rec.version} · Brand Canon v{rec.canon_version} · <span suppressHydrationWarning>{new Date(rec.approved_at).toLocaleString("en-IN")}</span></p>
          <p className="mt-1 break-all font-mono text-[10.5px] text-gray-500">sha256 {rec.hash}</p>
          <p className="mt-1">Approved by {rec.approvers.map((a) => `${a.name} (${a.role})`).join(", ")}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(sub.draft_text)} className="h-7 rounded-lg border border-gray-300 px-2.5 text-xs font-medium hover:bg-gray-50">Copy approved text</button>
            {isCreatorSide && <ActionButton small variant="ghost" confirm="Reopening unlocks the content and needs a new approval. Continue?" action={() => reopenAction(sub.id)}>Reopen for changes</ActionButton>}
          </div>
        </div>
      )}

      {isCreatorSide && ["needs_fixes", "ready", "changes_requested"].includes(sub.status) && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <ActionButton variant="primary" disabled={blockingOpen > 0 || data.unchecked} action={() => submitAction(sub.id)} className="w-full">Submit for review</ActionButton>
          <p className="mt-1.5 text-xs text-gray-500">{data.unchecked ? "Run the check on your latest changes first." : blockingOpen > 0 ? `Resolve ${blockingOpen} blocker/major issue${blockingOpen === 1 ? "" : "s"} first.` : "All blockers and majors are resolved."}</p>
        </div>
      )}

      {sub.status === "in_review" && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {iAmReviewer && !alreadyMine ? (
            <div className="space-y-2">
              {exceptions.length > 0 && (
                <div className="rounded-lg bg-orange-50 p-2.5 text-xs text-orange-900">
                  <b>{exceptions.length} exception request{exceptions.length > 1 ? "s" : ""}</b> from the creator:
                  <ul className="mt-1 list-disc pl-4">{exceptions.map((e) => <li key={e.id}>{e.title}: “{e.decision_reason}”</li>)}</ul>
                </div>
              )}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for the creator (required for changes or exceptions)" className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
              <div className="flex flex-wrap gap-2">
                {exceptions.length === 0 && <ActionButton variant="primary" action={() => reviewAction(sub.id, "approved", note)}>Approve</ActionButton>}
                <ActionButton variant="secondary" action={() => reviewAction(sub.id, "changes_requested", note)}>Request changes</ActionButton>
                <ActionButton variant="danger" action={() => reviewAction(sub.id, "exception", note)}>Approve with exception</ActionButton>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              {iAmReviewer && alreadyMine ? "You've approved this version. Waiting for the other reviewer." : `Waiting for review. Switch role (top right) to ${required.map((r) => ROLE_PERSON[r].split(" (")[0]).join(" or ")} to approve.`}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function Comments({ data, quote, setQuote }: { data: WorkspaceData; quote: string; setQuote: (s: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-4">
      {data.comments.length === 0 && <p className="text-sm text-gray-500">No comments yet. Select any text in the content to comment on that line.</p>}
      {data.comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <Avatar initials={c.author.initials} color={c.author.color} />
          <div className="text-sm">
            <p><b>{c.author.name}</b> <span className="text-xs text-gray-500">{c.author.roleLabel} · <TimeAgo date={c.created_at} /></span></p>
            {c.quote && <p className="my-1 border-l-2 border-brand-200 pl-2 text-xs italic text-gray-500">“{c.quote}”</p>}
            <p className="text-gray-800">{c.body}</p>
          </div>
        </div>
      ))}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        {quote && <p className="flex items-center gap-2 text-xs text-gray-600">Commenting on: <span className="italic">“{quote}”</span><button onClick={() => setQuote("")} className="text-gray-400 hover:text-gray-700">✕</button></p>}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={`Comment as ${data.me.name}…`} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <ActionButton small variant="primary" action={() => commentAction(data.sub.id, body, quote || null)} onDone={(r) => { if (r.ok) { setBody(""); setQuote(""); } }}>Post comment</ActionButton>
      </div>
    </div>
  );
}

function Versions({ data }: { data: WorkspaceData }) {
  const [sel, setSel] = useState(data.versions.length ? data.versions[data.versions.length - 1].n : 0);
  const v = data.versions.find((x) => x.n === sel);
  const prev = data.versions.find((x) => x.n === sel - 1);
  if (!v) return <p className="text-sm text-gray-500">No checked versions yet.</p>;
  const parts = prev ? diffWords(prev.text, v.text) : [{ value: v.text, added: false, removed: false }];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {data.versions.map((x) => (
          <button key={x.n} onClick={() => setSel(x.n)} className={`rounded-md border px-2.5 py-1 text-xs ${x.n === sel ? "border-brand-500 bg-brand-50 font-semibold" : "border-gray-200"}`}>v{x.n}</button>
        ))}
      </div>
      <p className="text-xs text-gray-500">v{v.n} · checked by {v.author} <TimeAgo date={v.created_at} /> · Brand Canon v{v.canon_version}{prev ? ` · changes since v${prev.n}` : " · first version"}</p>
      <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed">
        {parts.map((p, i) => <span key={i} className={p.added ? "rounded bg-brand-100 text-brand-700" : p.removed ? "rounded bg-red-50 text-red-700 line-through" : ""}>{p.value}</span>)}
      </div>
      {(v.image_alt || v.image_text) && <p className="text-xs text-gray-500">Image alt: {v.image_alt || "—"} · Image text: {v.image_text || "—"}</p>}
    </div>
  );
}

const ACTION_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  "submission.created": () => "created the submission",
  "check.ran": (d) => `ran the check (v${d.version}): ${d.blocker} blocker, ${d.major} major, ${d.minor} minor${d.ai ? ` · AI: ${d.ai}` : " · code checks only"}`,
  "finding.accepted": (d) => `accepted a fix (${d.rule ?? d.title}): “${d.from}” → “${d.to}”`,
  "finding.dismissed": (d) => `dismissed ${d.rule ?? d.title}: ${d.reason}`,
  "finding.exception_requested": (d) => `requested an exception for ${d.rule ?? d.title}: ${d.reason}`,
  "draft.edited": () => "edited the content",
  submitted: (d) => `submitted v${d.version} for review (${(d.route as string[])?.join(" + ")})`,
  "review.approved": (d) => `approved v${d.version}${d.note ? `: “${d.note}”` : ""}`,
  "review.exception": (d) => `approved v${d.version} with an exception: “${d.note}”`,
  "review.changes_requested": (d) => `requested changes: “${d.note}”`,
  "approved.locked": (d) => `all approvals in. v${d.version} locked (sha256 ${String(d.hash).slice(0, 12)}…)`,
  "comment.added": () => "commented",
  reopened: () => "reopened the content for changes",
};

function Activity({ data }: { data: WorkspaceData }) {
  return (
    <ul className="space-y-2 text-sm">
      {data.activity.map((a) => (
        <li key={a.id} className="flex gap-2">
          <span className="w-20 shrink-0 text-xs text-gray-400"><TimeAgo date={a.created_at} /></span>
          <span><b>{a.actor}</b> {ACTION_TEXT[a.action]?.(a.detail) ?? a.action}</span>
        </li>
      ))}
    </ul>
  );
}

function AiUse({ data }: { data: WorkspaceData }) {
  const c = data.check;
  return (
    <div className="space-y-3 text-sm">
      {!c ? <p className="text-gray-500">Not checked yet.</p> : c.ai_used ? (
        <p>AI was used in the latest check (<b>{c.ai_model}</b>) for tone, messaging, claims and the intent card{data.sub.image_data ? ", and to read the image" : ""}. {c.redactions ? <b>{c.redactions} private item(s) were masked</b> : "No private data was found to mask"} before sending. Every AI finding was checked by code: if its citation was not real, it became an <i>advisory</i> that can&apos;t block.</p>
      ) : (
        <p>No AI was used in the latest check. All findings came from code checks against the Brand Canon. (AI tone and messaging checks turn on when a Gemini API key is configured, or the AI call failed: see the log below.)</p>
      )}
      {c?.notes?.length ? <ul className="list-disc pl-5 text-xs text-gray-500">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      {data.aiCalls.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-left text-gray-500"><tr><th className="py-1">When</th><th>Purpose</th><th>Model</th><th>Result</th><th>Text sent (masked)</th></tr></thead>
          <tbody>
            {data.aiCalls.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 align-top">
                <td className="py-1.5 pr-2 text-gray-500"><TimeAgo date={a.created_at} /></td>
                <td className="pr-2">{a.purpose}</td>
                <td className="pr-2 font-mono">{a.model}</td>
                <td className="pr-2">{a.ok ? `ok · ${a.latency_ms} ms` : <span className="text-red-700">failed: {a.error}</span>}</td>
                <td className="max-w-[240px] truncate text-gray-500" title={a.redacted_input ?? ""}>{a.redacted_input}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
