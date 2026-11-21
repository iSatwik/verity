// The check pipeline:
// 1. code checks on the text (and on any text inside the image)
// 2. mask private data → AI review (if configured) → citation verifier
// 3. image colour / contrast / alt-text checks
// 4. intent card (AI, or a simple automatic summary)

import type { Canon } from "../canon";
import { runCodeChecks } from "./rules";
import { autoIntent } from "./core";
import { redact } from "./redact";
import { aiReview, aiDescribeImage, aiProvider, type AiLog } from "./ai";
import { analyseImage } from "./image";
import { ocrImage, privateBoxes, blurBoxes, dataUrlToBuffer, raster, measureTextContrast, checkLogo, logoFindings, type OcrResult, type Box, type TextContrast } from "./vision";
import { type CheckInput, type CheckResult, type Finding, SEVERITY_ORDER } from "./types";

export async function runPipeline(canon: Canon, input: CheckInput, log: (l: AiLog) => void = () => {}, opts: { ai?: boolean } = {}): Promise<CheckResult> {
  const useAi = opts.ai !== false;
  const notes: string[] = [];
  const text = input.text ?? "";

  // 1. code checks on text
  const findings: Finding[] = runCodeChecks(canon, text, input.channel, "text");

  // 2. image: read the text inside it. Local OCR first (no AI, gives the text boxes), then the vision AI on a copy
  //    where private words are blurred. The creator's own text wins if they typed it.
  let imageText = input.imageText ?? "";
  let suggestedAlt: string | null = null;
  let detected: string | null = null;
  let aiModel: string | null = null;
  let ocr: OcrResult | null = null;
  let blurred = 0;
  let logoBox: Box | null = null;
  let logoSeen: boolean | null = null;
  const buf = input.imageData ? dataUrlToBuffer(input.imageData) : null;
  if (buf) {
    try { ocr = await ocrImage(buf); } catch (e) { notes.push(`The text in the image could not be read locally (${(e as Error).message}).`); }
    let aiImage = input.imageData!;
    if (ocr) {
      const pb = privateBoxes(ocr.lines, canon);
      if (pb.boxes.length) {
        aiImage = "data:image/jpeg;base64," + (await blurBoxes(buf, ocr.width, ocr.height, pb.boxes)).toString("base64");
        blurred = pb.boxes.length;
        notes.push(`${pb.count} private item(s) in the image were blurred before the image went to the AI.`);
      }
    }
    // fail closed: if we couldn't look for private words, the image only goes to the company's own AI server
    const safeToSend = ocr !== null || aiProvider() === "company";
    if (useAi && !safeToSend) notes.push("The image was not sent to the AI because it could not be checked for private words first.");
    const vision = useAi && safeToSend ? await aiDescribeImage(aiImage, log).catch(() => null) : null;
    if (vision) {
      aiModel = vision.model;
      if (vision.text_in_image && !imageText.trim()) { imageText = vision.text_in_image; detected = vision.text_in_image; }
      suggestedAlt = vision.alt_text ?? null;
      logoSeen = vision.logo?.present ?? null;
      const b = vision.logo?.box_2d;
      if (vision.logo?.present && Array.isArray(b) && b.length === 4 && ocr) {
        const [ymin, xmin, ymax, xmax] = b.map(Number);
        if ([ymin, xmin, ymax, xmax].every((v) => Number.isFinite(v)) && xmax > xmin && ymax > ymin)
          logoBox = { x0: (xmin / 1000) * ocr.width, y0: (ymin / 1000) * ocr.height, x1: (xmax / 1000) * ocr.width, y1: (ymax / 1000) * ocr.height };
      }
    }
    if (!imageText.trim() && ocr && ocr.text.trim()) { imageText = ocr.text; detected = ocr.text; }
    // private lines are blurred for the AI, but must still be checked (confidential words) by code
    if (blurred && ocr) {
      const priv = ocr.lines.filter((l) => redact(l.text, canon).count).map((l) => l.text).join(" ");
      if (priv && !imageText.includes(priv)) imageText = `${imageText} ${priv}`.trim();
    }
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
      let measured: TextContrast[] | undefined;
      let logo: NonNullable<CheckResult["imageReport"]>["logo"] = null;
      if (buf && ocr) {
        const r0 = await raster(buf, ocr.width, ocr.height);
        if (ocr.lines.length) measured = measureTextContrast(r0, ocr.lines);
        if (logoBox) {
          const rep = checkLogo(r0, logoBox, ocr.lines);
          logo = { found: true, aspect: rep.aspect, widthShare: rep.widthShare, colourDelta: rep.colourDelta, problems: rep.problems };
          findings.push(...logoFindings(rep, canon.rules.find((x) => x.id === "VI-3")?.body ?? ""));
        } else if (logoSeen === false) logo = { found: false, problems: [] };
      }
      const r = await analyseImage(input.imageData, canon, { hasText: imageText.trim().length > 0, altText: input.imageAlt, suggestedAlt, measured });
      const source = detected ? (aiModel && detected !== ocr?.text ? ("ai" as const) : ("ocr" as const)) : ("creator" as const);
      imageReport = r.report ? { ...r.report, textSource: source, textBoxes: measured, logo, blurred } : null;
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
