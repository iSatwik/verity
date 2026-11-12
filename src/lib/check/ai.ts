// AI layer. The AI only PROPOSES findings; code VERIFIES every citation before a finding can count.
// Provider: Google Gemini (GEMINI_API_KEY). Without a key the app still works with code checks only.
// AI_MODE=mock gives deterministic fake AI answers, used only for local testing of the verifier.

import type { Canon } from "../canon";
import type { Finding, Intent, Severity } from "./types";
import { unmask } from "./redact";

export interface AiLog { purpose: string; model: string; redacted_input: string; ok: boolean; latency_ms: number; error?: string }

export function aiProvider(): "gemini" | "mock" | "none" {
  if (process.env.AI_MODE === "mock") return "mock";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "none";
}

const MODELS = (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []).concat(["gemini-3.5-flash", "gemini-2.5-flash"]);

async function geminiJSON(parts: unknown[], log: (l: AiLog) => void, purpose: string, redactedInput: string): Promise<{ data: unknown; model: string } | null> {
  const key = process.env.GEMINI_API_KEY as string;
  let lastErr = "";
  for (const model of MODELS) {
    const t0 = Date.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.status === 404) { lastErr = `${model}: not found`; continue; }
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const raw = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const data = JSON.parse(raw.replace(/^```json\s*|```$/g, ""));
      log({ purpose, model, redacted_input: redactedInput.slice(0, 4000), ok: true, latency_ms: Date.now() - t0 });
      return { data, model };
    } catch (e) {
      lastErr = (e as Error).message;
      log({ purpose, model, redacted_input: redactedInput.slice(0, 4000), ok: false, latency_ms: Date.now() - t0, error: lastErr.slice(0, 300) });
      return null;
    }
  }
  log({ purpose, model: MODELS.join(","), redacted_input: redactedInput.slice(0, 4000), ok: false, latency_ms: 0, error: lastErr });
  return null;
}

interface RawIssue {
  category?: string;
  source_id?: string;
  source_quote?: string;
  content_quote?: string;
  severity?: string;
  explanation?: string;
  suggestion?: string;
}
interface RawReview { intent?: Partial<Intent>; issues?: RawIssue[] }

function buildPrompt(maskedText: string, channel: string, canon: Canon, already: Finding[]): string {
  const rules = canon.rules
    .filter((r) => ["voice", "messaging", "claims", "imported"].includes(r.category))
    .map((r) => `${r.id}: ${r.body}${r.do_example ? ` | Do: ${r.do_example}` : ""}${r.dont_example ? ` | Don't: ${r.dont_example}` : ""}`)
    .join("\n");
  const facts = canon.facts.filter((f) => f.status === "active").map((f) => `${f.id}: ${f.statement}`).join("\n");
  const known = already.map((f) => `- "${f.quote ?? ""}" (${f.title})`).join("\n") || "- none";
  return `You are a brand-compliance reviewer for the brand "Aranya Naturals".
Check the CONTENT below against the brand RULES and APPROVED FACTS.
Only report problems about tone/voice, messaging, or claims that are NOT already in KNOWN ISSUES.
Every issue MUST cite one rule or fact ID from the lists, copy a short exact quote from that rule/fact text into "source_quote",
and copy the exact words from the CONTENT into "content_quote" (verbatim, character for character).
If you cannot cite a rule or fact, do not report the issue. Tokens like [CONFIDENTIAL_1] are masked text; leave them as they are.
The suggestion must replace content_quote, keep the writer's intent, and be as small as possible.
Also describe the writer's intent.

Return JSON only, shaped exactly like:
{"intent":{"goal":"","audience":"","key_message":"","cta":""},
 "issues":[{"category":"tone|messaging|claims","source_id":"V-02","source_quote":"","content_quote":"","severity":"major|minor","explanation":"","suggestion":""}]}

CHANNEL: ${channel}

RULES:
${rules}

APPROVED FACTS:
${facts}

KNOWN ISSUES (already reported by code, do not repeat):
${known}

CONTENT:
"""
${maskedText}
"""`;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"'’‘]/g, "").replace(/\s+/g, " ").trim();

/** The citation verifier: an AI finding only counts if its citation is real. */
export function verifyIssue(issue: RawIssue, canon: Canon, originalText: string, map: Record<string, string>): Finding {
  const contentQuote = unmask(issue.content_quote ?? "", map);
  const rule = canon.rules.find((r) => r.id === issue.source_id);
  const fact = canon.facts.find((f) => f.id === issue.source_id);
  const sourceText = rule ? [rule.body, rule.do_example ?? "", rule.dont_example ?? ""].join(" ") : fact?.statement ?? "";
  const reasons: string[] = [];
  if (!rule && !fact) reasons.push(`cited ID "${issue.source_id ?? "?"}" does not exist`);
  if ((rule || fact) && (!issue.source_quote || !norm(sourceText).includes(norm(issue.source_quote)))) reasons.push("quoted rule text doesn't match the rule");
  if (!contentQuote || !originalText.includes(contentQuote)) reasons.push("quoted content isn't in the post");
  const verified = reasons.length === 0;
  const cat = (["tone", "messaging", "claims"].includes(issue.category ?? "") ? issue.category : "tone") as Finding["category"];
  let sev: Severity = issue.severity === "minor" ? "minor" : "major";
  if (!verified) sev = "advisory";
  const start = contentQuote ? originalText.indexOf(contentQuote) : -1;
  return {
    location: "text",
    category: cat,
    severity: sev,
    title: verified ? (cat === "claims" ? "Claim not backed by an approved fact" : cat === "messaging" ? "Off-message" : "Off-voice") : "AI note (unverified)",
    message: (issue.explanation ?? "").trim() + (verified ? "" : ` [Not verified: ${reasons.join("; ")}. Shown as advisory only, so it can't block.]`),
    quote: contentQuote && start >= 0 ? contentQuote : undefined,
    suggestion: verified && issue.suggestion !== undefined ? unmask(issue.suggestion, map) : null,
    sources: verified ? [rule ? { id: rule.id, kind: "rule", text: rule.body } : { id: fact!.id, kind: "fact", text: fact!.statement }] : [],
    method: verified ? "ai" : "ai_unverified",
    start: start >= 0 ? start : undefined,
    end: start >= 0 ? start + contentQuote.length : undefined,
  };
}

export async function aiReview(opts: {
  maskedText: string; originalText: string; map: Record<string, string>; channel: string; canon: Canon; already: Finding[]; log: (l: AiLog) => void;
}): Promise<{ intent?: Intent; findings: Finding[]; model: string | null }> {
  const provider = aiProvider();
  if (provider === "none" || !opts.maskedText.trim()) return { findings: [], model: null };
  const prompt = buildPrompt(opts.maskedText, opts.channel, opts.canon, opts.already);
  let raw: RawReview | null = null;
  let model: string | null = null;
  if (provider === "mock") {
    raw = mockReview(opts.maskedText);
    model = "mock";
    opts.log({ purpose: "review", model, redacted_input: opts.maskedText, ok: true, latency_ms: 1 });
  } else {
    const r = await geminiJSON([{ text: prompt }], opts.log, "review", opts.maskedText);
    if (r) { raw = r.data as RawReview; model = r.model; }
  }
  if (!raw) return { findings: [], model: null };
  const findings = (raw.issues ?? []).slice(0, 8).map((i) => verifyIssue(i, opts.canon, opts.originalText, opts.map));
  // drop AI findings that overlap code findings
  const fresh = findings.filter((f) => !opts.already.some((a) => a.quote && f.quote && (a.quote.includes(f.quote) || f.quote.includes(a.quote))));
  const it = raw.intent;
  const intent: Intent | undefined = it && (it.goal || it.key_message)
    ? { goal: it.goal ?? "", audience: it.audience ?? "", key_message: unmask(it.key_message ?? "", opts.map), cta: it.cta ?? "", by: "ai" }
    : undefined;
  return { intent, findings: fresh, model };
}

export async function aiDescribeImage(dataUrl: string, log: (l: AiLog) => void): Promise<{ text_in_image?: string; alt_text?: string; model: string } | null> {
  const provider = aiProvider();
  if (provider === "none") return null;
  if (provider === "mock") {
    log({ purpose: "image", model: "mock", redacted_input: "[image]", ok: true, latency_ms: 1 });
    return { alt_text: "Product creative for Aranya Naturals with a bottle on a coloured background.", model: "mock" };
  }
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) return null;
  const r = await geminiJSON(
    [
      { text: 'Read this marketing image. Return JSON only: {"text_in_image": "all text visible in the image, in reading order", "alt_text": "one-sentence alt text describing the product and any text in the image"}' },
      { inline_data: { mime_type: m[1], data: m[2] } },
    ],
    log, "image", "[image]",
  );
  if (!r) return null;
  const d = r.data as { text_in_image?: string; alt_text?: string };
  return { ...d, model: r.model };
}

// Deterministic fake answers for testing the verifier without network access.
function mockReview(text: string): RawReview {
  const issues: RawIssue[] = [];
  const goodbye = text.match(/Say goodbye[^.!?]*[.!?]?/);
  if (/gorgeous/i.test(text)) {
    const q = text.match(/Hey gorgeous!?/)?.[0] ?? "gorgeous";
    issues.push({ category: "tone", source_id: "V-04", source_quote: "friendly, not casual", content_quote: q, severity: "minor", explanation: "\"Hey gorgeous\" may be too casual for the brand.", suggestion: "Hi there," });
  }
  if (goodbye) issues.push({ category: "messaging", source_id: "M-02", source_quote: "realistic results over weeks", content_quote: goodbye[0], severity: "major", explanation: "Promises quick results instead of realistic ones.", suggestion: "See visibly fewer blemishes in 4 weeks." });
  issues.push({ category: "tone", source_id: "V-99", source_quote: "be fun", content_quote: text.slice(0, 12), severity: "major", explanation: "Made-up rule to test the verifier.", suggestion: "" });
  return { intent: { goal: "Drive purchases", audience: "Young adults with oily skin", key_message: "Natural skincare that works", cta: "Buy now" }, issues };
}
