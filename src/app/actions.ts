"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { currentUser, ROLE_COOKIE } from "@/lib/session";
import { getUser } from "@/lib/users";
import * as store from "@/lib/store";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function wrap(fn: () => Promise<void | string>, paths: string[] = []): Promise<ActionResult> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    revalidatePath("/", "layout");
    return { ok: true, message: message || undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Something went wrong." };
  }
}

// ---------- role switcher (demo mode, no sign-in) ----------
export async function chooseRole(userId: string, next?: string) {
  const c = await cookies();
  c.set(ROLE_COOKIE, getUser(userId).id, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  const u = getUser(userId);
  redirect(next || (u.role === "creator" ? "/submissions" : u.role === "admin" ? "/canon" : "/review"));
}

// ---------- submissions ----------
export async function createAndCheck(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await currentUser();
  let id = 0;
  const res = await wrap(async () => {
    const text = String(form.get("text") ?? "");
    const imageData = String(form.get("imageData") ?? "") || null;
    if (!text.trim() && !imageData) throw new Error("Add some text, upload a document, or attach an image.");
    if (imageData && imageData.length > 6_000_000) throw new Error("Image is too large. Please use one under 4 MB.");
    id = await store.createSubmission(q, actor, {
      title: String(form.get("title") ?? ""),
      channel: String(form.get("channel") ?? "instagram"),
      text,
      imageData,
      imageAlt: String(form.get("imageAlt") ?? ""),
      imageText: String(form.get("imageText") ?? ""),
    });
    await store.runCheckFor(q, id, actor);
  });
  if (!res.ok) return res;
  redirect(`/submissions/${id}?checked=1`);
}

export async function extractFileText(form: FormData): Promise<{ text?: string; error?: string }> {
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "No file received." };
  if (file.size > 5_000_000) return { error: "File is larger than 5 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer: buf });
      return { text: r.value.replace(/\n{3,}/g, "\n\n").trim() };
    }
    if (name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      return { text: String(text).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() };
    }
    if (name.endsWith(".txt") || name.endsWith(".md")) return { text: buf.toString("utf8").trim() };
    return { error: "Supported files: .docx, .pdf, .txt" };
  } catch (e) {
    return { error: `Couldn't read that file: ${(e as Error).message}` };
  }
}

export async function runCheckAction(id: number): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(() => store.runCheckFor(q, id, actor), [`/submissions/${id}`]);
}
export async function acceptFixAction(fid: number, subId: number, edited?: string | null): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(() => store.acceptFix(q, fid, actor, edited), [`/submissions/${subId}`]);
}
export async function acceptAllAction(subId: number): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(async () => {
    const sub = await store.getSubmission(q, subId);
    if (!sub) throw new Error("Not found");
    const fs = await store.findingsFor(q, subId, sub.current_version);
    let n = 0;
    for (const f of fs) {
      if (f.status !== "open" || f.suggestion === null || f.method === "ai_unverified" || f.category === "visual") continue;
      try { await store.acceptFix(q, f.id, actor); n++; } catch { /* already changed */ }
    }
    return `${n} fix${n === 1 ? "" : "es"} applied. Run the check again to confirm.`;
  }, [`/submissions/${subId}`]);
}
export async function dismissAction(fid: number, subId: number, reason: string, note: string): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(() => store.dismissFinding(q, fid, actor, reason, note), [`/submissions/${subId}`]);
}
export async function reopenFindingAction(fid: number, subId: number): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(() => store.reopenFinding(q, fid, actor), [`/submissions/${subId}`]);
}
export async function saveDraftAction(subId: number, text: string, imageAlt: string | null, imageText: string | null, imageData?: string | null): Promise<ActionResult> {
  const actor = await currentUser();
  if (imageData && imageData.length > 6_000_000) return { ok: false, error: "Image is too large. Please use one under 4 MB." };
  return wrap(() => store.updateDraft(q, subId, actor, { text, imageAlt, imageText, imageData }), [`/submissions/${subId}`]);
}
export async function submitAction(subId: number): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(() => store.submitForReview(q, subId, actor), [`/submissions/${subId}`, "/review"]);
}
export async function reviewAction(subId: number, decision: "approved" | "changes_requested" | "exception", note: string): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(() => store.reviewDecision(q, subId, actor, decision, note), [`/submissions/${subId}`, "/review"]);
}
export async function reopenAction(subId: number): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(() => store.reopen(q, subId, actor), [`/submissions/${subId}`]);
}
export async function commentAction(subId: number, body: string, quote: string | null): Promise<ActionResult> {
  const actor = await currentUser();
  return wrap(() => store.addComment(q, subId, actor, body, quote), [`/submissions/${subId}`]);
}

// ---------- brand rules (admin) ----------
async function requireAdmin() {
  const u = await currentUser();
  if (u.role !== "admin") throw new Error("Only the brand admin can change the brand rules. Switch to Satwik (Brand admin) at the top right.");
  return u;
}
async function bumpCanon(actor: string, what: string, detail: Record<string, unknown>) {
  const row = await q<{ value: string }>("UPDATE canon_meta SET value = (value::int + 1)::text WHERE key = 'version' RETURNING value");
  await store.audit(q, actor, "canon.changed", null, { what, version: Number(row[0]?.value), ...detail });
}
const s = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };

export async function saveFactAction(form: FormData): Promise<ActionResult> {
  return wrap(async () => {
    const u = await requireAdmin();
    const id = s(form, "id");
    if (!id || !/^F-\d+$/i.test(id)) throw new Error("Fact ID must look like F-30.");
    const statement = s(form, "statement");
    if (!statement) throw new Error("Write the fact.");
    await q(`INSERT INTO facts (id, statement, product_id, kind, source, owner, valid_from, valid_until, status, suggested_copy, duration_days, price, check_pattern, check_value, keywords, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
      ON CONFLICT (id) DO UPDATE SET statement=$2, product_id=$3, kind=$4, source=$5, owner=$6, valid_from=$7, valid_until=$8, status=$9, suggested_copy=$10, duration_days=$11, price=$12, check_pattern=$13, check_value=$14, keywords=$15, updated_at=now()`,
      [id.toUpperCase(), statement, s(form, "product_id"), s(form, "kind") ?? "claim", s(form, "source"), s(form, "owner"), s(form, "valid_from"), s(form, "valid_until"), s(form, "status") ?? "active", s(form, "suggested_copy"), s(form, "duration_days"), s(form, "price"), s(form, "check_pattern"), s(form, "check_value"), s(form, "keywords")]);
    await bumpCanon(u.id, "fact.saved", { id });
    return `Saved ${id.toUpperCase()}. The Brand rules version went up by one.`;
  }, ["/canon"]);
}
export async function deleteCanonItemAction(table: "facts" | "terms" | "rules" | "confidential_terms", id: string): Promise<ActionResult> {
  return wrap(async () => {
    const u = await requireAdmin();
    if (!["facts", "terms", "rules", "confidential_terms"].includes(table)) throw new Error("Unknown table");
    await q(`DELETE FROM ${table} WHERE id = $1`, [id]);
    await bumpCanon(u.id, `${table}.deleted`, { id });
  }, ["/canon"]);
}
export async function saveTermAction(form: FormData): Promise<ActionResult> {
  return wrap(async () => {
    const u = await requireAdmin();
    const id = s(form, "id");
    if (!id) throw new Error("Term ID is required (e.g. T-20).");
    const variants = s(form, "variants");
    if (!variants) throw new Error("Add at least one word or phrase.");
    await q(`INSERT INTO terms (id, kind, variants, replacement, rule_id, severity, note) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET kind=$2, variants=$3, replacement=$4, rule_id=$5, severity=$6, note=$7`,
      [id.toUpperCase(), s(form, "kind") ?? "banned", variants, s(form, "replacement"), s(form, "rule_id") ?? id.toUpperCase(), s(form, "severity") ?? "major", s(form, "note")]);
    await bumpCanon(u.id, "term.saved", { id });
    return `Saved ${id.toUpperCase()}.`;
  }, ["/canon"]);
}
export async function saveRuleAction(form: FormData): Promise<ActionResult> {
  return wrap(async () => {
    const u = await requireAdmin();
    const id = s(form, "id");
    const body = s(form, "body");
    if (!id || !body) throw new Error("Rule ID and rule text are required.");
    await q(`INSERT INTO rules (id, category, title, body, do_example, dont_example, severity, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
      ON CONFLICT (id) DO UPDATE SET category=$2, title=$3, body=$4, do_example=$5, dont_example=$6, severity=$7, updated_at=now()`,
      [id.toUpperCase(), s(form, "category") ?? "voice", s(form, "title") ?? id, body, s(form, "do_example"), s(form, "dont_example"), s(form, "severity") ?? "major"]);
    await bumpCanon(u.id, "rule.saved", { id });
    return `Saved ${id.toUpperCase()}.`;
  }, ["/canon"]);
}
export async function saveConfidentialAction(form: FormData): Promise<ActionResult> {
  return wrap(async () => {
    const u = await requireAdmin();
    const phrase = s(form, "phrase");
    if (!phrase) throw new Error("Write the confidential word or phrase.");
    const id = `CT-${Date.now().toString().slice(-5)}`;
    await q("INSERT INTO confidential_terms (id, phrase, note) VALUES ($1,$2,$3)", [id, phrase, s(form, "note")]);
    await bumpCanon(u.id, "confidential.added", { id });
  }, ["/canon"]);
}

/** Import a brand guideline document: split it into numbered draft rules for the admin to review. */
export async function importGuidelineAction(form: FormData): Promise<ActionResult> {
  return wrap(async () => {
    const u = await requireAdmin();
    const r = await extractFileText(form);
    if (r.error || !r.text) throw new Error(r.error ?? "The document was empty.");
    const lines = r.text.split(/\n+/).map((l) => l.replace(/^[\s•\-*\d.)]+/, "").trim()).filter((l) => l.length >= 25 && l.length <= 400);
    const ruleLike = lines.filter((l) => /\b(must|never|always|don'?t|do not|should|avoid|use|only|no )\b/i.test(l)).slice(0, 40);
    if (!ruleLike.length) throw new Error("Couldn't find rule-like sentences (with words like must / never / always / avoid).");
    const existing = await q<{ id: string }>("SELECT id FROM rules WHERE id LIKE 'IMP-%'");
    let n = existing.length;
    for (const body of ruleLike) {
      n += 1;
      await q("INSERT INTO rules (id, category, title, body, severity) VALUES ($1,'imported',$2,$3,'minor') ON CONFLICT (id) DO NOTHING", [`IMP-${n}`, body.slice(0, 60), body]);
    }
    await bumpCanon(u.id, "guideline.imported", { rules: ruleLike.length });
    return `Imported ${ruleLike.length} rule(s) as IMP-… Review and re-categorise them below.`;
  }, ["/canon"]);
}

export async function resetDemoAction(): Promise<ActionResult> {
  return wrap(async () => {
    const { resetDemo } = await import("@/lib/seed");
    await resetDemo();
    return "Demo data reset.";
  }, ["/"]);
}
