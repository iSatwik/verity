"use client";

import { useState } from "react";
import { applyRuleRewriteAction, removeFalseAlarmAction } from "@/app/actions";
import { ActionButton } from "./ActionButton";
import { TimeAgo } from "./ui";
import type { RuleHealth } from "@/lib/rule-health";

type Item = RuleHealth & { title: string; body: string | null; rewritten: boolean; draft: { body: string; do_example: string; dont_example: string; based_on: string } | null };

const BADGE: Record<string, string> = { unclear: "bg-red-50 text-red-700", attention: "bg-amber-50 text-amber-800", clear: "bg-emerald-50 text-emerald-700" };
const LABEL: Record<string, string> = { unclear: "Unclear", attention: "Needs attention", clear: "Clear" };

export function RuleHealthList({ flagged, healthy, noData, alarms, isAdmin }: { flagged: Item[]; healthy: Item[]; noData: number; alarms: { id: number; rule_id: string; quote: string; title: string; created_at: string }[]; isAdmin: boolean }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Rules people find unclear ({flagged.length})</h2>
        {flagged.length === 0 && <p className="rounded-lg border border-gray-200 bg-white p-5 text-[14px] text-gray-500">No rule is causing confusion right now.</p>}
        {flagged.map((r) => <RuleCard key={r.ruleId} r={r} isAdmin={isAdmin} />)}
        <details className="rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer px-5 py-3 text-[14px] text-gray-700">Clear rules ({healthy.length}) · {noData} rules don&apos;t have enough decisions yet</summary>
          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {healthy.map((r) => (
              <div key={r.ruleId} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                <span className="w-14 shrink-0 font-mono font-semibold text-gray-700">{r.ruleId}</span>
                <span className="min-w-0 flex-1 truncate text-gray-700">{r.title}</span>
                <span className="text-gray-500">{r.score}/100</span>
              </div>
            ))}
          </div>
        </details>
      </div>
      <aside className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-[14px] font-semibold text-gray-900">Remembered false alarms ({alarms.length})</p>
        <p className="text-[13px] text-gray-500">When someone dismisses a warning as &quot;False positive&quot;, the same wording is not flagged again for that rule. Must-fix issues are never hidden this way.</p>
        {alarms.length === 0 && <p className="text-[13px] text-gray-400">None yet.</p>}
        <ul className="space-y-2">
          {alarms.map((a) => (
            <li key={a.id} className="rounded-md bg-gray-50 px-3 py-2 text-[13px]">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[11px] font-semibold text-gray-600">{a.rule_id}</span><span className="text-[11px] text-gray-400"><TimeAgo date={a.created_at} /></span></div>
              <p className="mt-0.5 text-gray-800">&ldquo;{a.quote}&rdquo;</p>
              {isAdmin && <div className="mt-1"><ActionButton small variant="secondary" action={() => removeFalseAlarmAction(a.id)}>Flag it again</ActionButton></div>}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function RuleCard({ r, isAdmin }: { r: Item; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(r.draft?.body ?? r.body ?? "");
  const [doEx, setDoEx] = useState(r.draft?.do_example ?? "");
  const [dontEx, setDontEx] = useState(r.draft?.dont_example ?? "");
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-gray-700">{r.ruleId}</span>
        <span className="text-[15px] font-semibold text-gray-900">{r.title}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${BADGE[r.status]}`}>{LABEL[r.status]} · {r.score}/100</span>
      </div>
      {r.body && <p className="mt-2 text-[14px] text-gray-700">&ldquo;{r.body}&rdquo;</p>}
      <p className="mt-1.5 text-[13px] text-gray-500">{r.why}</p>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100" title="Accepted / pushback">
        <div className="bg-emerald-500" style={{ width: `${(r.accepted / r.decided) * 100}%` }} />
        <div className="bg-red-400" style={{ width: `${(r.unclear / r.decided) * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${((r.falsePositive + r.dismissed + r.exceptions) / r.decided) * 100}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-gray-400"><span className="text-emerald-600">■</span> accepted <span className="ml-2 text-red-500">■</span> rule unclear <span className="ml-2 text-amber-500">■</span> false alarm, dismissed or exception</p>
      {r.draft && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500">Suggested clearer wording</p>
            <span className="text-[11px] text-gray-400">based on {r.draft.based_on}</span>
          </div>
          {!open ? (
            <>
              <p className="mt-1.5 text-[14px] text-gray-900">{r.draft.body}</p>
              {r.draft.do_example && <p className="mt-1 text-[13px] text-gray-600"><b className="font-medium text-emerald-700">Do:</b> {r.draft.do_example}</p>}
              {r.draft.dont_example && <p className="text-[13px] text-gray-600"><b className="font-medium text-red-700">Don&apos;t:</b> {r.draft.dont_example}</p>}
              {isAdmin ? <button onClick={() => setOpen(true)} className="mt-2.5 h-8 rounded-md bg-brand-500 px-3 text-[13px] font-medium text-white hover:bg-brand-600">Review and apply</button>
                : <p className="mt-2 text-[12px] text-gray-500">Only the brand admin (Satwik) can change rules.</p>}
            </>
          ) : (
            <div className="mt-2 space-y-2">
              <label className="block text-[12px] text-gray-600">Rule text<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[14px] text-gray-900" /></label>
              <label className="block text-[12px] text-gray-600">Do (example)<input value={doEx} onChange={(e) => setDoEx(e.target.value)} className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[14px] text-gray-900" /></label>
              <label className="block text-[12px] text-gray-600">Don&apos;t (example)<input value={dontEx} onChange={(e) => setDontEx(e.target.value)} className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[14px] text-gray-900" /></label>
              <div className="flex items-center gap-2">
                <ActionButton small variant="primary" action={() => applyRuleRewriteAction(r.ruleId, body, doEx, dontEx)}>Save as new rule version</ActionButton>
                <button onClick={() => setOpen(false)} className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
