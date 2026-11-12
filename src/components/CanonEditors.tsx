"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCanonItemAction, importGuidelineAction, saveConfidentialAction, saveFactAction, saveRuleAction, saveTermAction, type ActionResult } from "@/app/actions";
import type { Fact, Product, Rule, Term, ConfidentialTerm } from "@/lib/canon";
import { ActionButton } from "./ActionButton";
import { Card } from "./ui";

type Props =
  | { kind: "rule-row"; item: Rule }
  | { kind: "rule-new" }
  | { kind: "import" }
  | { kind: "fact-row"; item: Fact; products: Product[] }
  | { kind: "fact-new"; products: Product[] }
  | { kind: "term-row"; item: Term }
  | { kind: "term-new" }
  | { kind: "conf-row"; item: ConfidentialTerm }
  | { kind: "conf-new" };

function useFormAction(action: (f: FormData) => Promise<ActionResult>, onOk?: () => void) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const router = useRouter();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => { const r = await action(fd); setMsg(r); if (r.ok) { onOk?.(); router.refresh(); } });
  };
  return { pending, msg, submit };
}

const input = "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm";
function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block text-xs font-medium text-gray-600">{label}{children}{hint && <span className="mt-0.5 block font-normal text-gray-400">{hint}</span>}</label>;
}
function Msg({ msg }: { msg: ActionResult | null }) {
  if (!msg) return null;
  return <span className={`text-xs ${msg.ok ? "text-brand-700" : "text-red-700"}`}>{msg.ok ? msg.message ?? "Saved." : msg.error}</span>;
}
function Submit({ pending, label = "Save" }: { pending: boolean; label?: string }) {
  return <button disabled={pending} className="h-8 rounded-lg bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">{pending ? "Saving…" : label}</button>;
}

function RuleForm({ item, onDone }: { item?: Rule; onDone?: () => void }) {
  const { pending, msg, submit } = useFormAction(saveRuleAction, onDone);
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-6">
      <F label="ID"><input name="id" defaultValue={item?.id} readOnly={!!item} placeholder="V-09" className={input} /></F>
      <F label="Category"><select name="category" defaultValue={item?.category ?? "voice"} className={input}>{["voice", "messaging", "claims", "visual", "accessibility", "disclosure", "imported"].map((c) => <option key={c}>{c}</option>)}</select></F>
      <div className="sm:col-span-2"><F label="Short title"><input name="title" defaultValue={item?.title} className={input} /></F></div>
      <F label="Severity"><select name="severity" defaultValue={item?.severity ?? "major"} className={input}>{["blocker", "major", "minor"].map((c) => <option key={c}>{c}</option>)}</select></F>
      <div />
      <div className="sm:col-span-6"><F label="Rule text" hint="The AI checks tone and messaging against this text, and must quote it to cite it."><textarea name="body" defaultValue={item?.body} rows={2} className={input} /></F></div>
      <div className="sm:col-span-3"><F label="Do (example)"><input name="do_example" defaultValue={item?.do_example ?? ""} className={input} /></F></div>
      <div className="sm:col-span-3"><F label="Don't (example)"><input name="dont_example" defaultValue={item?.dont_example ?? ""} className={input} /></F></div>
      <div className="flex items-center gap-3 sm:col-span-6"><Submit pending={pending} /><Msg msg={msg} /></div>
    </form>
  );
}

function FactForm({ item, products, onDone }: { item?: Fact; products: Product[]; onDone?: () => void }) {
  const { pending, msg, submit } = useFormAction(saveFactAction, onDone);
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-6">
      <F label="ID"><input name="id" defaultValue={item?.id} readOnly={!!item} placeholder="F-30" className={input} /></F>
      <F label="Type"><select name="kind" defaultValue={item?.kind ?? "claim"} className={input}>{["claim", "result", "price", "offer", "delivery", "ingredient", "tested", "company"].map((c) => <option key={c}>{c}</option>)}</select></F>
      <F label="Product"><select name="product_id" defaultValue={item?.product_id ?? ""} className={input}><option value="">All / none</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>
      <F label="Status"><select name="status" defaultValue={item?.status ?? "active"} className={input}><option value="active">active</option><option value="draft">draft (no proof yet)</option></select></F>
      <F label="Valid from"><input type="date" name="valid_from" defaultValue={item?.valid_from ?? ""} className={input} /></F>
      <F label="Valid until"><input type="date" name="valid_until" defaultValue={item?.valid_until ?? ""} className={input} /></F>
      <div className="sm:col-span-6"><F label="Approved fact"><textarea name="statement" defaultValue={item?.statement} rows={2} className={input} /></F></div>
      <div className="sm:col-span-2"><F label="Source document"><input name="source" defaultValue={item?.source ?? ""} className={input} /></F></div>
      <F label="Owner"><input name="owner" defaultValue={item?.owner ?? ""} className={input} /></F>
      <div className="sm:col-span-3"><F label="Approved wording (used as the suggested fix)"><input name="suggested_copy" defaultValue={item?.suggested_copy ?? ""} className={input} /></F></div>
      <F label="Price ₹" hint="price / delivery facts"><input name="price" defaultValue={item?.price ?? ""} className={input} /></F>
      <F label="Result takes (days)" hint="result facts"><input name="duration_days" defaultValue={item?.duration_days ?? ""} className={input} /></F>
      <div className="sm:col-span-2"><F label="Number check (regex)" hint={'e.g. (\\d+)\\s?%\\s*aloe'}><input name="check_pattern" defaultValue={item?.check_pattern ?? ""} className={`${input} font-mono`} /></F></div>
      <F label="Expected number"><input name="check_value" defaultValue={item?.check_value ?? ""} className={input} /></F>
      <F label="Keywords" hint="a|b|c"><input name="keywords" defaultValue={item?.keywords ?? ""} className={input} /></F>
      <div className="flex items-center gap-3 sm:col-span-6"><Submit pending={pending} /><Msg msg={msg} /></div>
    </form>
  );
}

function TermForm({ item, onDone }: { item?: Term; onDone?: () => void }) {
  const { pending, msg, submit } = useFormAction(saveTermAction, onDone);
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-6">
      <F label="ID"><input name="id" defaultValue={item?.id} readOnly={!!item} placeholder="T-20" className={input} /></F>
      <F label="Type"><select name="kind" defaultValue={item?.kind ?? "banned"} className={input}>{["banned", "product_name", "brand_name", "preferred"].map((c) => <option key={c}>{c}</option>)}</select></F>
      <div className="sm:col-span-2"><F label="Words to flag" hint="Separate with |. Start with = for case-sensitive."><input name="variants" defaultValue={item?.variants} className={input} /></F></div>
      <F label="Use instead"><input name="replacement" defaultValue={item?.replacement ?? ""} className={input} /></F>
      <F label="Severity"><select name="severity" defaultValue={item?.severity ?? "major"} className={input}>{["blocker", "major", "minor"].map((c) => <option key={c}>{c}</option>)}</select></F>
      <div className="sm:col-span-4"><F label="Why (shown to the creator)"><input name="note" defaultValue={item?.note ?? ""} className={input} /></F></div>
      <F label="Rule ID"><input name="rule_id" defaultValue={item?.rule_id ?? ""} className={input} /></F>
      <div className="flex items-end gap-3"><Submit pending={pending} /></div>
      <div className="sm:col-span-6"><Msg msg={msg} /></div>
    </form>
  );
}

function Inline({ children, label = "Edit" }: { children: (close: () => void) => React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-brand-600 hover:underline">{label}</button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-6 pt-24" onClick={() => setOpen(false)}>
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-between"><p className="font-semibold">Edit</p><button onClick={() => setOpen(false)} className="text-gray-400">✕</button></div>
            {children(() => setOpen(false))}
          </div>
        </div>
      )}
    </>
  );
}

export function CanonEditors(p: Props) {
  switch (p.kind) {
    case "rule-row":
      return <span className="flex gap-3"><Inline>{(c) => <RuleForm item={p.item} onDone={c} />}</Inline><ActionButton small variant="ghost" confirm={`Delete ${p.item.id}?`} action={() => deleteCanonItemAction("rules", p.item.id)}>Delete</ActionButton></span>;
    case "fact-row":
      return <span className="flex gap-3"><Inline>{(c) => <FactForm item={p.item} products={p.products} onDone={c} />}</Inline><ActionButton small variant="ghost" confirm={`Delete ${p.item.id}?`} action={() => deleteCanonItemAction("facts", p.item.id)}>Delete</ActionButton></span>;
    case "term-row":
      return <span className="flex gap-3"><Inline>{(c) => <TermForm item={p.item} onDone={c} />}</Inline><ActionButton small variant="ghost" confirm={`Delete ${p.item.id}?`} action={() => deleteCanonItemAction("terms", p.item.id)}>Delete</ActionButton></span>;
    case "conf-row":
      return <ActionButton small variant="ghost" confirm="Remove this confidential term?" action={() => deleteCanonItemAction("confidential_terms", p.item.id)}>Remove</ActionButton>;
    case "rule-new":
      return <Card className="p-4"><p className="mb-3 text-sm font-semibold">Add a rule</p><RuleForm /></Card>;
    case "fact-new":
      return <Card className="p-4"><p className="mb-1 text-sm font-semibold">Add an approved fact</p><p className="mb-3 text-xs text-gray-500">Facts are what claims are checked against. Give each one a source and an expiry date so outdated prices and offers get caught.</p><FactForm products={p.products} /></Card>;
    case "term-new":
      return <Card className="p-4"><p className="mb-3 text-sm font-semibold">Add a term rule</p><TermForm /></Card>;
    case "conf-new":
      return <ConfNew />;
    case "import":
      return <ImportGuideline />;
  }
}

function ConfNew() {
  const { pending, msg, submit } = useFormAction(saveConfidentialAction);
  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-semibold">Add a confidential term</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <F label="Word or phrase"><input name="phrase" className={input} /></F>
        <F label="Note"><input name="note" className={input} /></F>
        <Submit pending={pending} label="Add" /><Msg msg={msg} />
      </form>
    </Card>
  );
}

function ImportGuideline() {
  const { pending, msg, submit } = useFormAction(importGuidelineAction);
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold">Import a brand guideline document</p>
      <p className="mb-3 text-xs text-gray-500">Upload a .docx, .pdf or .txt brand book. Verity pulls out rule-like sentences (with words like must, never, always, avoid) and adds them as numbered draft rules (IMP-1, IMP-2…) for you to review and re-categorise.</p>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <input type="file" name="file" accept=".docx,.pdf,.txt,.md" className="text-sm" required />
        <Submit pending={pending} label="Import" /><Msg msg={msg} />
      </form>
    </Card>
  );
}
