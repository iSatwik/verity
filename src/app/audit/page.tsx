import Link from "next/link";
import { q } from "@/lib/db";
import { getUser } from "@/lib/users";
import { Card, timeAgo } from "@/components/ui";

export default async function AuditPage() {
  const [events, ai] = await Promise.all([
    q<{ id: number; actor_id: string; action: string; submission_id: number | null; detail: unknown; created_at: string; title: string | null }>(
      "SELECT a.*, s.title FROM audit_events a LEFT JOIN submissions s ON s.id = a.submission_id ORDER BY a.id DESC LIMIT 200"),
    q<{ id: number; submission_id: number | null; purpose: string; model: string; ok: boolean; latency_ms: number; error: string | null; redacted_input: string | null; created_at: string }>(
      "SELECT * FROM ai_calls ORDER BY id DESC LIMIT 50"),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-gray-500">Every check, fix, dismissal, comment, approval and Brand Canon change, with who did it and when. AI calls are listed separately with the masked text that was sent.</p>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500"><tr><th className="px-4 py-2.5">When</th><th className="px-2">Who</th><th className="px-2">Action</th><th className="px-2">Submission</th><th className="px-2">Details</th></tr></thead>
          <tbody>
            {events.map((e) => {
              const d = typeof e.detail === "string" ? JSON.parse(e.detail) : e.detail;
              return (
                <tr key={e.id} className="border-t border-gray-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{timeAgo(e.created_at)}</td>
                  <td className="whitespace-nowrap px-2 py-2">{getUser(e.actor_id).name}</td>
                  <td className="px-2 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-2 py-2 text-xs">{e.submission_id ? <Link className="underline" href={`/submissions/${e.submission_id}`}>#{e.submission_id} {e.title}</Link> : "Brand Canon"}</td>
                  <td className="max-w-md px-2 py-2 text-xs text-gray-600"><code className="break-words">{JSON.stringify(d)}</code></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card className="overflow-x-auto">
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold">AI calls ({ai.length})</div>
        {ai.length === 0 && <p className="px-4 py-5 text-sm text-gray-500">No AI calls yet. Without a Gemini API key, Verity runs code checks only.</p>}
        {ai.length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-left text-gray-500"><tr><th className="px-4 py-2">When</th><th>Submission</th><th>Purpose</th><th>Model</th><th>Result</th><th>Text sent (masked)</th></tr></thead>
            <tbody>{ai.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-2 text-gray-500">{timeAgo(a.created_at)}</td><td>{a.submission_id ? `#${a.submission_id}` : ""}</td><td>{a.purpose}</td><td className="font-mono">{a.model}</td>
                <td>{a.ok ? `ok · ${a.latency_ms} ms` : <span className="text-red-700">failed: {a.error}</span>}</td>
                <td className="max-w-sm truncate text-gray-500" title={a.redacted_input ?? ""}>{a.redacted_input}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
