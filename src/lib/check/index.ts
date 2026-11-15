// The check pipeline:
// 1. code checks on the text (and on any text inside the image)
// 2. mask private data → AI review (if configured) → citation verifier
// 3. image colour / contrast / alt-text checks
// 4. intent card (AI, or a simple automatic summary)

import type { Canon } from "../canon";
import { runCodeChecks } from "./rules";
import { autoIntent } from "./core";
import { redact } from "./redact";
import { aiReview, aiDescribeImage, type AiLog } from "./ai";
import { analyseImage } from "./image";
import { type CheckInput, type CheckResult, type Finding, SEVERITY_ORDER } from "./types";

export async function runPipeline(canon: Canon, input: CheckInput, log: (l: AiLog) => void = () => {}, opts: { ai?: boolean } = {}): Promise<CheckResult> {
  const useAi = opts.ai !== false;
  const notes: string[] = [];
  const text = input.text ?? "";

  // 1. code checks on text
  const findings: Finding[] = runCodeChecks(canon, text, input.channel, "text");

  // 2. image: read the text inside it (AI if available, otherwise what the creator typed)
  let imageText = input.imageText ?? "";
  let suggestedAlt: string | null = null;
  let detected: string | null = null;
  let aiModel: string | null = null;
  if (input.imageData) {
    const vision = useAi ? await aiDescribeImage(input.imageData, log).catch(() => null) : null;
    if (vision) {
      aiModel = vision.model;
      if (vision.text_in_image && !imageText.trim()) { imageText = vision.text_in_image; detected = vision.text_in_image; }
      suggestedAlt = vision.alt_text ?? null;
    }
  }
  if (input.imageData && !suggestedAlt) {
    const p = canon.products.find((x) => new RegExp(x.keywords, "i").test(`${imageText} ${text}`));
    suggestedAlt = `${p ? p.name : "Aranya Naturals product"} creative${imageText.trim() ? ` with the text: "${imageText.trim().replace(/\s+/g, " ").slice(0, 120)}"` : ""}.`;
  }
  if (imageText.trim()) {
    for (const f of runCodeChecks(canon, imageText, input.channel, "image", text)) findings.push({ ...f, location: "image", start: undefined, end: undefined });
  }

  // 3. AI review on masked text
  const red = redact(text, canon);
  if (red.count) notes.push(`${red.count} item(s) masked before the AI check.`);
  const ai = !useAi ? { findings: [] as Finding[], model: null as string | null, intent: undefined } : await aiReview({ maskedText: red.masked, originalText: text, map: red.map, channel: input.channel, canon, already: findings.filter((f) => f.location !== "image"), log }).catch((e) => {
    notes.push(`AI check failed: ${(e as Error).message}`);
    return { findings: [] as Finding[], model: null as string | null, intent: undefined };
  });
  if (ai.model) aiModel = ai.model;
  findings.push(...ai.findings);

  // 4. image visuals
  let imageReport = null;
  if (input.imageData) {
    try {
      const r = await analyseImage(input.imageData, canon, { hasText: imageText.trim().length > 0, altText: input.imageAlt, suggestedAlt });
      imageReport = r.report ? { ...r.report, textSource: detected ? ("ai" as const) : ("creator" as const) } : null;
      findings.push(...r.findings);
    } catch (e) {
      notes.push(`Image could not be analysed: ${(e as Error).message}`);
    }
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.location === b.location ? 0 : a.location === "text" ? -1 : 1) || (a.start ?? 0) - (b.start ?? 0));

  return {
    findings,
    intent: ai.intent ?? autoIntent(text || imageText, input.channel),
    imageReport,
    aiUsed: Boolean(aiModel),
    aiModel,
    redactions: red.count,
    notes,
    detectedImageText: detected,
    suggestedAlt,
  };
}

export { autoIntent, riskTier } from "./core";
