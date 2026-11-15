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
import { Avatar, TimeAgo, SEVERITY_LABEL, nb } from "./ui";
import { ChannelFrame } from "./ChannelFrame";

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

const PERSON: Record<string, string> = { manager: "Ritika S.", compliance: "Arjun V." };
const ROLE_NAME: Record<string, string> = { manager: "Brand manager", compliance: "Compliance" };
const SEV_ORDER = ["blocker", "major", "minor", "advisory"] as const;
const SEV_BAR: Record<string, string> = { blocker: "border-l-red-500", major: "border-l-amber-400", minor: "border-l-sky-400", advisory: "border-l-gray-300" };
const SEV_TEXT: Record<string, string> = { blocker: "text-red-700", major: "text-amber-700", minor: "text-sky-700", advisory: "text-gray-500" };

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

function flash(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}

function Section({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="text-[13px] font-semibold text-gray-900">{title}</h2>
        {right}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
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
  const [tab, setTab] = useState<"comments" | "history" | "activity" | "ai">("comments");

  const open = findings.filter((f) => f.status === "open");
  const required = open.filter((f) => f.severity === "blocker" || f.severity === "major");
  const exceptions = findings.filter((f) => f.status === "exception_requested");
  const fixable = open.filter((f) => f.suggestion !== null && f.method !== "ai_unverified" && f.category !== "visual");
  const segments = useMemo(() => highlightSegments(sub.draft_text, findings), [sub.draft_text, findings]);

  const [base, setBase] = useState({ text: sub.draft_text, imageAlt: sub.image_alt ?? "", imageText: sub.image_text ?? "" });
  const startEdit = () => { setDraft(sub.draft_text); setAlt(sub.image_alt ?? ""); setImgText(sub.image_text ?? ""); setNewImage(undefined); setBase({ text: sub.draft_text, imageAlt: sub.image_alt ?? "", imageText: sub.image_text ?? "" }); setEditing(true); };
  const stepIdx = sub.status === "approved" ? 4 : sub.status === "in_review" ? 3 : sub.current_version === 0 ? 0 : required.length === 0 && !data.unchecked ? 2 : 1;
  const steps = ["Draft", "Checked", "Fixed", "In review", "Approved"];
  const checkedVersion = data.versions.find((v) => v.n === sub.current_version);

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <Link href="/submissions" className="text-[13px] text-gray-500 hover:text-gray-800">← Submissions</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">{sub.title}</h1>
            <p className="mt-1 text-[13px] text-gray-500">
              {CHANNELS[sub.channel] ?? sub.channel} · by {sub.author.name} · version {sub.current_version}
              {check && <> · checked <TimeAgo date={check.created_at} /> against Brand rules v{checkedVersion?.canon_version ?? data.canonVersion}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editable && !editing && <button onClick={startEdit} className="h-9 rounded-md border border-gray-300 bg-white px-3.5 text-sm text-gray-800 hover:bg-gray-50">Edit</button>}
            {editable && <ActionButton action={() => runCheckAction(sub.id)} variant={data.unchecked ? "primary" : "secondary"}>{data.unchecked ? "Run check" : "Check again"}</ActionButton>}
            {isCreatorSide && ["needs_fixes", "ready", "changes_requested"].includes(sub.status) && (
              <ActionButton variant={!data.unchecked && required.length === 0 ? "primary" : "secondary"} disabled={required.length > 0 || data.unchecked} action={() => submitAction(sub.id)} title={required.length ? "Resolve the must-fix and should-fix issues first" : data.unchecked ? "Run the check first" : ""}>Submit for review</ActionButton>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${i < stepIdx ? "bg-brand-500 text-white" : i === stepIdx ? "border-2 border-brand-500 text-brand-700" : "border border-gray-300 text-gray-400"}`}>{i < stepIdx ? "✓" : i + 1}</span>
            <span className={i === stepIdx ? "font-semibold text-gray-900" : i < stepIdx ? "text-gray-700" : "text-gray-400"}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-gray-300" />}
          </li>
        ))}
      </ol>

      <NextStep data={data} required={required.length} exceptions={exceptions.length} isCreatorSide={isCreatorSide} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* LEFT: the content */}
        <div className="space-y-5">
          <Section title="Content" right={!editing && sub.draft_text ? <span className="text-[12px] text-gray-400">Click an underlined part to see the issue</span> : undefined}>
            {editing ? (
              <div className="space-y-4">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={7} className="w-full rounded-md border border-gray-300 p-3 text-[15px] leading-relaxed" />
                <div className="space-y-3 rounded-md bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {(newImage ?? sub.image_data) && <img src={(newImage ?? sub.image_data)!} alt="Current image" className="h-16 w-16 rounded border border-gray-200 object-cover" />}
                    <label className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
                      {sub.image_data || newImage ? "Replace image" : "Add image"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setNewImage(await fileToDataUrl(f)); }} />
                    </label>
                    {sub.image_data && sub.title === "Neem cleanser launch post" && (
                      <button type="button" onClick={async () => {
                        const blob = await (await fetch("/samples/creative-s01-fixed.jpg")).blob();
                        setNewImage(await fileToDataUrl(blob));
                        setImgText("Clearer skin, naturally. See visibly fewer blemishes in 4 weeks of regular use. ₹349. Aranya Naturals Neem Purifying Cleanser 100 ml");
                        setAlt("Aranya Naturals Neem Purifying Cleanser bottle with neem leaves on a forest-green background. Text: Clearer skin, naturally. See visibly fewer blemishes in 4 weeks of regular use. ₹349");
                      }} className="text-sm text-brand-700 underline underline-offset-2">Use the designer&apos;s corrected image (demo)</button>
                    )}
                    {(newImage ?? sub.image_data) && <button type="button" onClick={() => setNewImage("")} className="text-sm text-gray-500 hover:text-gray-800">Remove image</button>}
                  </div>
                  {(newImage ?? sub.image_data) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-[13px] text-gray-600">Alt text<input value={alt} onChange={(e) => setAlt(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" /></label>
                      <label className="text-[13px] text-gray-600">Words in the image<input value={imgText} onChange={(e) => setImgText(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" /></label>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <ActionButton variant="primary" action={() => saveDraftAction(sub.id, draft, alt, imgText, newImage, base)} onDone={(r) => { if (r.ok) { setEditing(false); setNewImage(undefined); } }}>Save</ActionButton>
                  <button onClick={() => setEditing(false)} className="h-9 rounded-md px-3 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            ) : (
              <ChannelFrame channel={sub.channel} title={sub.title}>
              <div className="whitespace-pre-wrap text-[16px] leading-[1.9] text-gray-900" onMouseUp={() => { const s = window.getSelection()?.toString().trim(); if (s && s.length > 2) { setQuote(s.slice(0, 200)); setTab("comments"); } }}>
                {sub.draft_text ? segments.map((seg, i) => seg.f ? (
                  <mark key={i} id={`m-${seg.f.id}`} onClick={() => flash(`f-${seg.f!.id}`)} title={seg.f.title} className={`hl ${seg.f.status === "open" ? `hl-${seg.f.severity}` : "hl-done"}`}>{seg.text}</mark>
                ) : <span key={i}>{seg.text}</span>) : <span className="text-gray-400">No text. Only the image is checked.</span>}
              </div>
              </ChannelFrame>
            )}
            {check?.intent && !editing && (
              <p className="mt-4 border-t border-gray-100 pt-3 text-[13px] text-gray-500">
                <span className="text-gray-700">What this is trying to do:</span> {lowerFirst(trimDot(check.intent.goal))}{check.intent.audience ? ` for ${lowerFirst(trimDot(check.intent.audience))}` : ""}{check.intent.cta && check.intent.cta !== "None" ? `. Call to action: “${check.intent.cta}”` : ""}. Suggested fixes keep this.
              </p>
            )}
          </Section>

          {sub.image_data && <ImageSection data={data} />}

          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="flex gap-5 border-b border-gray-100 px-5 text-[13px]">
              {([["comments", `Comments${data.comments.length ? ` (${data.comments.length})` : ""}`], ["history", "Versions"], ["activity", "Activity"], ["ai", "AI use"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 py-3 ${tab === k ? "border-gray-900 font-semibold text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{l}</button>
              ))}
            </div>
            <div className="px-5 py-4">
              {tab === "comments" && <Comments data={data} quote={quote} setQuote={setQuote} />}
              {tab === "history" && <Versions data={data} />}
              {tab === "activity" && <Activity data={data} />}
              {tab === "ai" && <AiUse data={data} />}
            </div>
          </section>
        </div>

        {/* RIGHT: approval + issues */}
        <div className="space-y-5">
          {(["in_review", "approved"].includes(sub.status) || exceptions.length > 0) && <ApprovalPanel data={data} exceptions={exceptions} isCreatorSide={isCreatorSide} />}

          <section className="rounded-lg border border-gray-200 bg-white lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)] lg:flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-[13px] font-semibold text-gray-900">Issues {sub.current_version > 0 && <span className="font-normal text-gray-500">· {open.length} open</span>}</h2>
              {editable && fixable.length > 1 && <ActionButton small variant="secondary" action={() => acceptAllAction(sub.id)}>Accept all {fixable.length} suggestions</ActionButton>}
            </div>
            <div className="lg:min-h-0 lg:overflow-y-auto">
            {sub.current_version === 0 && <p className="px-5 py-4 text-sm text-gray-500">Not checked yet.</p>}
            {sub.current_version > 0 && findings.length === 0 && <p className="px-5 py-4 text-sm text-gray-700">No issues found. Every claim matches an approved fact.</p>}
            {SEV_ORDER.map((sev) => {
              const list = open.filter((f) => f.severity === sev);
              if (!list.length) return null;
              return (
                <div key={sev} className="border-b border-gray-100 last:border-b-0">
                  <p className={`px-5 pb-1 pt-4 text-[12px] font-semibold ${SEV_TEXT[sev]}`}>{SEVERITY_LABEL[sev]} · {list.length}</p>
                  <div className="divide-y divide-gray-100">{list.map((f) => <IssueRow key={f.id} f={f} subId={sub.id} editable={editable} />)}</div>
                </div>
              );
            })}
            {findings.some((f) => f.status !== "open") && (
              <details className="border-t border-gray-100">
                <summary className="cursor-pointer px-5 py-3 text-[13px] text-gray-500 hover:text-gray-800">Resolved · {findings.filter((f) => f.status !== "open").length}</summary>
                <div className="divide-y divide-gray-100">{findings.filter((f) => f.status !== "open").map((f) => <IssueRow key={f.id} f={f} subId={sub.id} editable={editable} />)}</div>
              </details>
            )}
          </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NextStep({ data, required, exceptions, isCreatorSide }: { data: WorkspaceData; required: number; exceptions: number; isCreatorSide: boolean }) {
  const { sub, me, approvals } = data;
  const last = [...approvals].reverse().find((a) => a.decision === "changes_requested");
  const waitingFor = data.required.filter((r) => !approvals.some((a) => a.role === r && a.decision !== "changes_requested")).map((r) => PERSON[r]);
  const myRole = me.role === "admin" ? "manager" : me.role;
  let msg: React.ReactNode = null;
  if (data.unchecked && !["in_review", "approved"].includes(sub.status)) msg = <>You changed the content after the last check. <b>Run the check</b> to see what&apos;s left.</>;
  else if (sub.status === "changes_requested" && last && isCreatorSide) msg = <><b>{last.name} asked for changes:</b> “{last.note}”. Edit the content, check it again and resubmit.</>;
  else if (sub.status === "needs_fixes" && isCreatorSide) msg = <><b>{required} issue{required === 1 ? "" : "s"} to resolve before you can submit.</b> For each one, accept the suggestion, edit the text yourself, or dismiss it with a reason.</>;
  else if (sub.status === "ready" && isCreatorSide) msg = <><b>Ready to submit.</b> All required issues are resolved{exceptions ? `, and ${exceptions} exception request${exceptions > 1 ? "s" : ""} will go to the reviewers` : ""}.</>;
  else if (sub.status === "in_review" && data.required.includes(myRole as "manager" | "compliance") && waitingFor.includes(PERSON[myRole])) msg = <><b>Your review.</b> Read the content and the creator&apos;s decisions, then approve or request changes.</>;
  else if (sub.status === "in_review") msg = <>Waiting for review by {waitingFor.join(" and ")}. {isCreatorSide ? "You'll see their decision here." : "Switch role at the top right to review as them."}</>;
  else if (sub.status === "approved") msg = <><b>Approved and locked.</b> This exact version can be published.</>;
  else if (sub.status === "changes_requested" && last) msg = <><b>{last.name} asked for changes:</b> “{last.note}”. Waiting for the creator to update it.</>;
  else if (["needs_fixes", "ready", "changes_requested"].includes(sub.status)) msg = <>The creator is still working on this.</>;
  if (!msg) return null;
  return <div className={`rounded-lg px-4 py-3 text-[14px] ${sub.status === "approved" ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-800"}`}>{msg}</div>;
}

function IssueRow({ f, subId, editable }: { f: WFinding; subId: number; editable: boolean }) {
  const [mode, setMode] = useState<"none" | "edit" | "dismiss">("none");
  const [edited, setEdited] = useState(f.suggestion ?? "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [moreSources, setMoreSources] = useState(false);
  const decided = f.status !== "open";
  const canApply = f.suggestion !== null && f.category !== "visual" && f.method !== "ai_unverified";
  const statusLabel: Record<string, string> = { accepted: "Fixed", dismissed: "Dismissed", exception_requested: "Exception requested", resolved: "Fixed by another change" };
  const [main, ...rest] = f.sources;
  return (
    <div id={`f-${f.id}`} className={`border-l-[3px] px-5 py-4 ${decided ? "border-l-transparent" : SEV_BAR[f.severity]}`}>
      <div className="flex items-baseline justify-between gap-3">
        <button onClick={() => flash(`m-${f.id}`)} className={`text-left text-[14px] font-semibold ${decided ? "text-gray-500" : "text-gray-900"} hover:underline`}>{f.title}</button>
        <span className="shrink-0 text-[11px] text-gray-400">{f.location === "image" ? "in image" : ""}{f.method === "ai" ? `${f.location === "image" ? " · " : ""}AI, verified` : f.method === "ai_unverified" ? "AI, unverified" : ""}</span>
      </div>
      {!decided && <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{nb(f.message)}</p>}
      {f.quote && f.category !== "visual" && (
        <p className="mt-2 text-[13px] leading-relaxed">
          <span className={decided ? "text-gray-400 line-through" : "text-red-700 line-through decoration-red-300"}>{f.quote}</span>
          {f.suggestion !== null && <> <span className="text-gray-400">→</span> <span className={decided ? "text-gray-500" : "font-medium text-brand-700"}>{f.suggestion === "" ? "(remove)" : f.suggestion}</span></>}
        </p>
      )}
      {f.category === "visual" && f.suggestion && !decided && (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-gray-600"><span className="inline-block h-3.5 w-3.5 rounded-sm border border-gray-200" style={{ background: f.quote ?? undefined }} />{f.quote} <span className="text-gray-400">→ closest brand colour</span><span className="inline-block h-3.5 w-3.5 rounded-sm border border-gray-200" style={{ background: f.suggestion }} />{f.suggestion}</p>
      )}
      {main && !decided && (
        <div className="mt-2 text-[12px] leading-snug text-gray-500">
          <span className="whitespace-nowrap font-mono font-semibold text-gray-700">{main.id}</span> {nb(main.text)}
          {rest.length > 0 && !moreSources && <button onClick={() => setMoreSources(true)} className="ml-1 text-gray-400 underline underline-offset-2 hover:text-gray-700">+{rest.length} more</button>}
          {moreSources && rest.map((s) => <div key={s.id} className="mt-1"><span className="whitespace-nowrap font-mono font-semibold text-gray-700">{s.id}</span> {nb(s.text)}</div>)}
        </div>
      )}
      {f.location === "image" && f.category !== "accessibility" && !decided && <p className="mt-1.5 text-[12px] text-gray-400">This is in the image itself. Fix the design, then use Edit → Replace image.</p>}
      {decided && (
        <p className="mt-1 flex items-center gap-2 text-[12px] text-gray-500">
          <span className="font-medium text-gray-700">{statusLabel[f.status] ?? f.status}</span>{f.decision_reason && f.status !== "accepted" && f.status !== "resolved" && <span>· {f.decision_reason}</span>}
          {editable && ["dismissed", "exception_requested"].includes(f.status) && <span className="ml-auto"><ActionButton small variant="ghost" action={() => reopenFindingAction(f.id, subId)}>Undo</ActionButton></span>}
        </p>
      )}
      {!decided && editable && (
        <div className="mt-3">
          {mode === "none" && (
            <div className="flex flex-wrap gap-2">
              {canApply && <ActionButton small variant="primary" action={() => acceptFixAction(f.id, subId)}>{f.title === "Missing alt text" ? "Use this alt text" : "Accept"}</ActionButton>}
              {canApply && <button onClick={() => setMode("edit")} className="h-7 rounded-md border border-gray-300 px-2.5 text-xs text-gray-700 hover:bg-gray-50">Edit</button>}
              <button onClick={() => setMode("dismiss")} className="h-7 rounded-md px-2 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800">{f.severity === "blocker" ? "Ask for an exception" : "Dismiss"}</button>
            </div>
          )}
          {mode === "edit" && (
            <div className="space-y-2">
              <textarea value={edited} onChange={(e) => setEdited(e.target.value)} rows={2} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm" />
              <div className="flex gap-2"><ActionButton small variant="primary" action={() => acceptFixAction(f.id, subId, edited)}>Apply</ActionButton><button onClick={() => setMode("none")} className="h-7 px-2 text-xs text-gray-500">Cancel</button></div>
            </div>
          )}
          {mode === "dismiss" && (
            <div className="space-y-2">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm">
                <option value="">Reason…</option>
                {DISMISS_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={f.severity === "blocker" ? "Why should this be allowed? (required)" : "Note (optional)"} className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm" />
              {f.severity === "blocker" && <p className="text-[12px] text-gray-500">A reviewer will have to approve this exception.</p>}
              <div className="flex gap-2"><ActionButton small variant="secondary" action={() => dismissAction(f.id, subId, reason, note)}>{f.severity === "blocker" ? "Send exception request" : "Dismiss"}</ActionButton><button onClick={() => setMode("none")} className="h-7 px-2 text-xs text-gray-500">Cancel</button></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImageSection({ data }: { data: WorkspaceData }) {
  const { sub, check } = data;
  const rep = check?.image_report;
  const colours = rep?.colours.filter((c) => c.share >= 0.03) ?? [];
  return (
    <Section title="Image">
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sub.image_data!} alt={sub.image_alt || "Uploaded image (no alt text yet)"} className="w-full rounded-md border border-gray-200" />
        <dl className="space-y-3 text-[13px]">
          <div><dt className="text-gray-500">Alt text</dt><dd className="mt-0.5 text-gray-900">{sub.image_alt || <span className="text-amber-700">Missing</span>}</dd></div>
          <div><dt className="text-gray-500">Words in the image{rep?.textSource === "ai" ? " (read by AI)" : ""}</dt><dd className="mt-0.5 text-gray-900">{sub.image_text || <span className="text-gray-400">None</span>}</dd></div>
          {colours.length > 0 && (
            <div>
              <dt className="text-gray-500">Main colours</dt>
              <dd className="mt-0.5">
                {(() => { const off = colours.filter((c) => !c.onBrand).length; return off ? <span className="font-medium text-red-700">{off} of {colours.length} are not brand colours</span> : <span className="text-gray-900">All match the brand colours</span>; })()}
                <span className="mt-1.5 flex flex-wrap gap-2.5">
                  {colours.map((c) => (
                    <span key={c.hex} title={`${c.onBrand ? "Brand colour" : "Not a brand colour"}. Nearest brand colour: ${c.nearest} ${c.nearestHex}`} className="flex items-center gap-1 text-[12px] text-gray-500">
                      <span className={`h-4 w-4 rounded-sm ${c.onBrand ? "border border-gray-200" : "ring-2 ring-red-500 ring-offset-1"}`} style={{ background: c.hex }} />
                      {Math.round(c.share * 100)}%
                    </span>
                  ))}
                </span>
              </dd>
            </div>
          )}
          {rep?.contrast && (
            <div><dt className="text-gray-500">Text contrast (estimated)</dt><dd className="mt-0.5"><span className={rep.contrast.ratio < 4.5 ? "font-medium text-red-700" : "font-medium text-gray-900"}>{rep.contrast.ratio} : 1</span> <span className="text-gray-400">· needs at least 4.5 : 1</span></dd></div>
          )}
        </dl>
      </div>
    </Section>
  );
}

function ApprovalPanel({ data, exceptions, isCreatorSide }: { data: WorkspaceData; exceptions: WFinding[]; isCreatorSide: boolean }) {
  const { sub, me, approvals, required } = data;
  const [note, setNote] = useState("");
  const myRole = me.role === "admin" ? "manager" : me.role;
  const iAmReviewer = required.includes(myRole as "manager" | "compliance");
  const alreadyMine = approvals.some((a) => a.role === myRole && a.decision !== "changes_requested");
  const rec = sub.review_record;
  return (
    <Section title="Approval">
      <ul className="space-y-2 text-[13px]">
        {required.map((r) => {
          const a = approvals.find((x) => x.role === r && x.decision !== "changes_requested");
          return (
            <li key={r} className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${a ? "bg-brand-500 text-white" : "border border-gray-300"}`}>{a ? "✓" : ""}</span>
              <span><span className="text-gray-900">{PERSON[r]}</span> <span className="text-gray-500">· {ROLE_NAME[r]}</span>
                {a ? <span className="block text-gray-500">{a.decision === "exception" ? "Approved with an exception" : "Approved"} <TimeAgo date={a.created_at} />{a.note ? `: “${a.note}”` : ""}</span> : sub.status === "in_review" ? <span className="block text-gray-400">Waiting</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {sub.risk_tier === "claims" && sub.status !== "approved" && <p className="mt-3 text-[12px] text-gray-500">This content makes claims or offers, so compliance reviews it too.</p>}

      {sub.status !== "approved" && exceptions.length > 0 && (
        <div className="mt-3 rounded-md bg-orange-50 px-3 py-2.5 text-[13px] text-orange-900">
          <p className="font-medium">Exception request{exceptions.length > 1 ? "s" : ""} from the creator</p>
          <ul className="mt-1 space-y-0.5">{exceptions.map((e) => <li key={e.id}>{e.title}: “{e.decision_reason}”</li>)}</ul>
        </div>
      )}

      {sub.status === "in_review" && iAmReviewer && !alreadyMine && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for the creator (needed if you request changes or approve an exception)" className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            {exceptions.length === 0 ? <ActionButton variant="primary" action={() => reviewAction(sub.id, "approved", note)}>Approve</ActionButton> : <ActionButton variant="primary" action={() => reviewAction(sub.id, "exception", note)}>Approve with exception</ActionButton>}
            <ActionButton variant="secondary" action={() => reviewAction(sub.id, "changes_requested", note)}>Request changes</ActionButton>
          </div>
        </div>
      )}

      {rec && sub.status === "approved" && (
        <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-[12px] text-gray-500">
          <p>Locked version {rec.version} · Brand rules v{rec.canon_version} · <span suppressHydrationWarning>{new Date(rec.approved_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST</span></p>
          <p className="break-all font-mono text-[11px] text-gray-400">sha256 {rec.hash}</p>
          <div className="flex gap-2 pt-2">
            <button onClick={() => navigator.clipboard?.writeText(sub.draft_text).catch(() => {})} className="h-7 rounded-md border border-gray-300 px-2.5 text-xs text-gray-700 hover:bg-gray-50">Copy approved text</button>
            {isCreatorSide && <ActionButton small variant="ghost" confirm="Reopening unlocks the content and needs a new approval. Continue?" action={() => reopenAction(sub.id)}>Reopen for changes</ActionButton>}
          </div>
        </div>
      )}
    </Section>
  );
}

function Comments({ data, quote, setQuote }: { data: WorkspaceData; quote: string; setQuote: (s: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-4">
      {data.comments.length === 0 && <p className="text-[13px] text-gray-500">No comments yet. Tip: select words in the content to comment on that part.</p>}
      {data.comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <Avatar initials={c.author.initials} color={c.author.color} size={26} />
          <div className="text-[13px]">
            <p><span className="font-medium text-gray-900">{c.author.name}</span> <span className="text-gray-400">· <TimeAgo date={c.created_at} /></span></p>
            {c.quote && <p className="my-1 border-l-2 border-gray-200 pl-2 text-gray-500">“{c.quote}”</p>}
            <p className="text-gray-800">{c.body}</p>
          </div>
        </div>
      ))}
      <div className="space-y-2">
        {quote && <p className="flex items-center gap-2 text-[12px] text-gray-500">On: “{quote}” <button onClick={() => setQuote("")} className="text-gray-400 hover:text-gray-700">✕</button></p>}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={`Write a comment as ${data.me.name}`} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <ActionButton small variant="secondary" action={() => commentAction(data.sub.id, body, quote || null)} onDone={(r) => { if (r.ok) { setBody(""); setQuote(""); } }}>Post comment</ActionButton>
      </div>
    </div>
  );
}

function Versions({ data }: { data: WorkspaceData }) {
  const [sel, setSel] = useState(data.versions.length ? data.versions[data.versions.length - 1].n : 0);
  const v = data.versions.find((x) => x.n === sel);
  const prev = data.versions.find((x) => x.n === sel - 1);
  if (!v) return <p className="text-[13px] text-gray-500">No checked versions yet.</p>;
  const parts = prev ? diffWords(prev.text, v.text) : [{ value: v.text, added: false, removed: false }];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {data.versions.map((x) => <button key={x.n} onClick={() => setSel(x.n)} className={`rounded-md px-2.5 py-1 text-[12px] ${x.n === sel ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>v{x.n}</button>)}
      </div>
      <p className="text-[12px] text-gray-500">v{v.n} · {v.author} · <TimeAgo date={v.created_at} />{prev ? ` · changes since v${prev.n}` : " · first version"}</p>
      <div className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-[14px] leading-relaxed">
        {parts.map((p, i) => <span key={i} className={p.added ? "bg-brand-100 text-brand-700" : p.removed ? "text-red-600 line-through" : ""}>{p.value}</span>)}
      </div>
    </div>
  );
}

const ACTION_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  "submission.created": () => "created this",
  "check.ran": (d) => `ran the check on v${d.version}: ${d.blocker} must fix, ${d.major} should fix, ${d.minor} nice to fix`,
  "finding.accepted": (d) => `accepted a fix: “${d.from}” → “${d.to}”`,
  "finding.dismissed": (d) => `dismissed ${d.rule ?? d.title}: ${d.reason}`,
  "finding.exception_requested": (d) => `asked for an exception on ${d.rule ?? d.title}: ${d.reason}`,
  "draft.edited": (d) => (d.imageReplaced ? "edited the content and replaced the image" : "edited the content"),
  submitted: (d) => `submitted v${d.version} for review`,
  "review.approved": (d) => `approved v${d.version}${d.note ? `: “${d.note}”` : ""}`,
  "review.exception": (d) => `approved v${d.version} with an exception: “${d.note}”`,
  "review.changes_requested": (d) => `asked for changes: “${d.note}”`,
  "approved.locked": (d) => `all approvals done, v${d.version} locked`,
  "comment.added": () => "commented",
  reopened: () => "reopened it for changes",
};

function Activity({ data }: { data: WorkspaceData }) {
  return (
    <ul className="space-y-2.5 text-[13px]">
      {data.activity.map((a) => (
        <li key={a.id} className="flex gap-3">
          <span className="w-20 shrink-0 text-gray-400"><TimeAgo date={a.created_at} /></span>
          <span className="text-gray-700"><span className="font-medium text-gray-900">{a.actor}</span> {ACTION_TEXT[a.action]?.(a.detail) ?? a.action}</span>
        </li>
      ))}
    </ul>
  );
}

function AiUse({ data }: { data: WorkspaceData }) {
  const c = data.check;
  return (
    <div className="space-y-3 text-[13px] text-gray-700">
      {!c ? <p className="text-gray-500">Not checked yet.</p> : c.ai_used ? (
        <p>The last check used <b>{c.ai_model}</b> for tone, messaging and claims{data.sub.image_data ? ", and to read the image" : ""}. {c.redactions ? `${c.redactions} private item(s) were hidden before sending.` : "No private details needed hiding."} Every AI issue was checked against the cited rule. If the citation wasn&apos;t real, it&apos;s marked “AI, unverified” and can&apos;t block anything.</p>
      ) : (
        <p>No AI was used in the last check. Everything came from code checks against the brand rules.</p>
      )}
      {c?.notes?.length ? <ul className="list-disc pl-5 text-[12px] text-gray-500">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      {data.aiCalls.length > 0 && (
        <table className="w-full text-[12px]">
          <thead className="text-left text-gray-400"><tr><th className="py-1 font-normal">When</th><th className="font-normal">Purpose</th><th className="font-normal">Result</th><th className="font-normal">Text sent (private details hidden)</th></tr></thead>
          <tbody>{data.aiCalls.map((a) => (
            <tr key={a.id} className="border-t border-gray-100 align-top">
              <td className="py-1.5 pr-2 text-gray-500"><TimeAgo date={a.created_at} /></td><td className="pr-2">{a.purpose}</td>
              <td className="pr-2">{a.ok ? "ok" : <span className="text-red-700">failed</span>}</td>
              <td className="max-w-[260px] truncate text-gray-500" title={a.redacted_input ?? ""}>{a.redacted_input}</td>
            </tr>))}</tbody>
        </table>
      )}
    </div>
  );
}

/** "Promote X." -> "promote X" (keeps brand names capitalised, drops the trailing full stop). */
function trimDot(t: string) { return t.trim().replace(/[.\s]+$/, ""); }
function lowerFirst(t: string) { return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
