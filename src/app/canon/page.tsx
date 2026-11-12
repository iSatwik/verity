import Link from "next/link";
import { q } from "@/lib/db";
import { loadCanonWith, factState } from "@/lib/canon";
import { currentUser } from "@/lib/session";
import { Card } from "@/components/ui";
import { CanonEditors } from "@/components/CanonEditors";

const TABS = [
  ["rules", "Rules"],
  ["facts", "Approved facts"],
  ["terms", "Terminology"],
  ["visual", "Visual identity"],
  ["confidential", "Confidential terms"],
] as const;

const CATS: Record<string, string> = { voice: "Voice & tone", messaging: "Messaging", claims: "Claims", visual: "Visual", accessibility: "Accessibility", disclosure: "Disclosure", confidential: "Confidential", imported: "Imported (needs review)" };

export default async function CanonPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "rules" } = await searchParams;
  const canon = await loadCanonWith(q);
  const me = await currentUser();
  const isAdmin = me.role === "admin";
  const facts = canon.facts.map((f) => ({ ...f, state: factState(f) }));
  const attention = facts.filter((f) => f.state !== "active").length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Brand rules <span className="ml-1 rounded-md bg-brand-50 px-2 py-0.5 align-middle text-sm font-semibold text-brand-700">v{canon.version}</span></h1>
          <p className="text-sm text-gray-500">Aranya Naturals&apos; approved rules, facts, words and colours. Every finding in Verity points to one of these IDs. {canon.rules.length} rules · {canon.facts.length} facts · {canon.terms.length} term rules.</p>
        </div>
        {!isAdmin && <p className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">Read-only. Switch to <b>Satwik (Brand admin)</b> to edit.</p>}
      </div>
      {attention > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{attention} fact(s) need attention (expired, expiring within 14 days, upcoming or without proof). See <Link className="underline" href="/canon?tab=facts">Approved facts</Link>.</p>}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map(([k, l]) => <Link key={k} href={`/canon?tab=${k}`} className={`whitespace-nowrap px-3 py-2 text-sm ${tab === k ? "border-b-2 border-brand-500 font-semibold" : "text-gray-500 hover:text-gray-800"}`}>{l}</Link>)}
      </div>

      {tab === "rules" && (
        <div className="space-y-4">
          {Object.entries(CATS).map(([cat, label]) => {
            const rs = canon.rules.filter((r) => r.category === cat);
            if (!rs.length) return null;
            return (
              <Card key={cat} className="overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
                <table className="w-full text-sm">
                  <tbody>
                    {rs.map((r) => (
                      <tr key={r.id} className="border-t border-gray-100 align-top">
                        <td className="w-20 px-4 py-2.5"><span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">{r.id}</span></td>
                        <td className="px-2 py-2.5"><b>{r.title}</b> <span className="text-gray-700">{r.body}</span>
                          {(r.do_example || r.dont_example) && <div className="mt-1 flex flex-wrap gap-2 text-xs">{r.do_example && <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-700">✓ {r.do_example}</span>}{r.dont_example && <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">✗ {r.dont_example}</span>}</div>}
                        </td>
                        <td className="w-24 px-4 py-2.5 text-xs capitalize text-gray-500">{r.severity}</td>
                        {isAdmin && <td className="w-36 px-4 py-2.5"><CanonEditors kind="rule-row" item={r} /></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          })}
          {isAdmin && <CanonEditors kind="rule-new" />}
          {isAdmin && <CanonEditors kind="import" />}
        </div>
      )}

      {tab === "facts" && (
        <div className="space-y-4">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500"><tr><th className="px-4 py-2.5">ID</th><th className="px-2">Approved fact</th><th className="px-2">Source</th><th className="px-2">Owner</th><th className="px-2">Valid until</th><th className="px-2">Status</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {facts.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-2.5"><span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">{f.id}</span></td>
                    <td className="px-2 py-2.5">{f.statement}{f.suggested_copy && <div className="text-xs text-gray-500">Approved wording: “{f.suggested_copy}”</div>}</td>
                    <td className={`px-2 py-2.5 text-xs ${f.status === "draft" ? "text-red-700" : "text-gray-600"}`}>{f.source}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-600">{f.owner}</td>
                    <td className="px-2 py-2.5 text-xs text-gray-600">{f.valid_until ?? "—"}</td>
                    <td className="px-2 py-2.5"><FactState state={f.state} /></td>
                    {isAdmin && <td className="px-4 py-2.5"><CanonEditors kind="fact-row" item={f} products={canon.products} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {isAdmin && <CanonEditors kind="fact-new" products={canon.products} />}
        </div>
      )}

      {tab === "terms" && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500"><tr><th className="px-4 py-2.5">ID</th><th className="px-2">Type</th><th className="px-2">Flag these words</th><th className="px-2">Use instead</th><th className="px-2">Severity</th>{isAdmin && <th />}</tr></thead>
              <tbody>
                {canon.terms.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100 align-top">
                    <td className="px-4 py-2.5"><span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">{t.id}</span></td>
                    <td className="px-2 py-2.5 text-xs capitalize text-gray-600">{t.kind.replace("_", " ")}</td>
                    <td className="px-2 py-2.5">{t.variants.split("|").map((v) => <span key={v} className="mb-1 mr-1 inline-block rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">{v.replace(/^=/, "")}</span>)}{t.note && <div className="text-xs text-gray-500">{t.note}</div>}</td>
                    <td className="px-2 py-2.5 text-brand-700">{t.replacement || <span className="text-xs text-gray-400">{t.id === "T-07" ? "the product's approved ingredient claim" : "remove / rewrite"}</span>}</td>
                    <td className="px-2 py-2.5 text-xs capitalize text-gray-600">{t.severity}</td>
                    {isAdmin && <td className="px-4 py-2.5"><CanonEditors kind="term-row" item={t} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="p-4 text-sm">
            <p className="mb-2 font-semibold">Approved product names</p>
            <div className="flex flex-wrap gap-2">{canon.products.map((p) => <span key={p.id} className="rounded-md border border-gray-200 px-2 py-1">{p.name} <span className="text-xs text-gray-400">{p.size}</span></span>)}</div>
          </Card>
          {isAdmin && <CanonEditors kind="term-new" />}
        </div>
      )}

      {tab === "visual" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <p className="mb-3 font-semibold">Brand colours</p>
            <div className="grid grid-cols-2 gap-3">
              {canon.palette.map((c) => (
                <div key={c.id} className="flex items-center gap-3"><span className="h-12 w-12 rounded-lg border border-gray-200" style={{ background: c.hex }} /><span className="text-sm"><b>{c.name}</b><br /><span className="font-mono text-xs text-gray-500">{c.hex}</span></span></div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">Images are checked pixel by pixel: a colour more than ΔE 6 (CIEDE2000) away from every brand colour, covering 8% or more of the image, is flagged. White, grey and black are allowed.</p>
          </Card>
          <Card className="p-5 text-sm">
            <p className="mb-2 font-semibold">Visual and accessibility rules</p>
            <ul className="space-y-2">
              {canon.rules.filter((r) => ["visual", "accessibility"].includes(r.category)).map((r) => <li key={r.id}><span className="mr-2 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">{r.id}</span>{r.body}</li>)}
            </ul>
          </Card>
        </div>
      )}

      {tab === "confidential" && (
        <div className="space-y-4">
          <Card className="p-5 text-sm">
            <p className="text-gray-600">These words are blocked from publishing, and they are <b>masked before any text is sent to an AI model</b>.</p>
            <ul className="mt-3 space-y-2">
              {canon.confidential.map((c) => (
                <li key={c.id} className="flex items-center gap-2"><span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{c.id}</span><b>{isAdmin || me.role === "compliance" ? c.phrase : "•••••••"}</b><span className="text-xs text-gray-500">{c.note}</span>{isAdmin && <span className="ml-auto"><CanonEditors kind="conf-row" item={c} /></span>}</li>
              ))}
            </ul>
            {!isAdmin && me.role !== "compliance" && <p className="mt-3 text-xs text-gray-500">Hidden for your role.</p>}
          </Card>
          {isAdmin && <CanonEditors kind="conf-new" />}
        </div>
      )}
    </div>
  );
}

function FactState({ state }: { state: string }) {
  const m: Record<string, [string, string]> = {
    active: ["Active", "bg-brand-50 text-brand-700"], expired: ["Expired", "bg-red-50 text-red-700"], draft: ["Draft · needs proof", "bg-gray-100 text-gray-600"],
    upcoming: ["Upcoming", "bg-blue-50 text-blue-700"], expiring: ["Expiring soon", "bg-amber-50 text-amber-800"],
  };
  const [l, c] = m[state] ?? m.active;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{l}</span>;
}
