// Improvement 1 + 3 (Round 3): local OCR, per-text contrast, logo checks and blurring private words in images.
// Everything here runs on the server with no AI: tesseract.js (OCR) + sharp (pixels) + culori (colour maths).

import path from "path";
import sharp from "sharp";
import { parse, wcagContrast, formatHex, differenceCiede2000 } from "culori";
import type { Canon } from "../canon";
import type { Finding } from "./types";
import { redact } from "./redact";

export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface OcrLine { text: string; conf: number; bbox: Box; words: { text: string; conf: number; bbox: Box }[] }
export interface OcrResult { width: number; height: number; lines: OcrLine[]; text: string }

// ---------- OCR ----------
type TWorker = { recognize: (img: Buffer, o?: object, out?: object) => Promise<{ data: { blocks?: { paragraphs: { lines: { text: string; confidence: number; bbox: Box; words: { text: string; confidence: number; bbox: Box }[] }[] }[] }[] } }> };
let workerP: Promise<TWorker> | null = null;
async function worker(): Promise<TWorker> {
  if (!workerP) {
    workerP = (async () => {
      const { createWorker } = await import("tesseract.js");
      const langPath = path.join(process.cwd(), "node_modules/@tesseract.js-data/eng/4.0.0_best_int");
      return (await createWorker("eng", 1, { langPath, gzip: true, cachePath: "/tmp/verity-ocr", logger: () => {} })) as unknown as TWorker;
    })().catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

/** Reads the text in an image with local OCR. Lines with low confidence or no real letters are dropped. */
export async function ocrImage(buf: Buffer, timeoutMs = 12000): Promise<OcrResult> {
  const img = sharp(buf).rotate();
  const meta = await img.metadata();
  const scale = Math.min(1, 1200 / Math.max(meta.width ?? 1, meta.height ?? 1));
  const width = Math.round((meta.width ?? 0) * scale), height = Math.round((meta.height ?? 0) * scale);
  const png = await img.resize(width, height).flatten({ background: "#ffffff" }).png().toBuffer();
  const w = await worker();
  const res = await Promise.race([
    w.recognize(png, {}, { blocks: true }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("OCR timed out")), timeoutMs)),
  ]);
  const lines: OcrLine[] = [];
  for (const b of res.data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) {
    const words = l.words.filter((x) => x.confidence >= 55 && /[A-Za-z0-9₹]{2,}|^[₹$]?\d/.test(x.text)).map((x) => ({ text: x.text, conf: x.confidence, bbox: x.bbox }));
    if (!words.length) continue;
    const text = words.map((x) => x.text).join(" ");
    const bbox = { x0: Math.min(...words.map((x) => x.bbox.x0)), y0: Math.min(...words.map((x) => x.bbox.y0)), x1: Math.max(...words.map((x) => x.bbox.x1)), y1: Math.max(...words.map((x) => x.bbox.y1)) };
    lines.push({ text, conf: l.confidence, bbox, words });
  }
  return { width, height, lines, text: lines.map((l) => l.text).join(" ") };
}

// ---------- pixels ----------
export interface Raster { data: Buffer; width: number; height: number; channels: number }
export async function raster(buf: Buffer, width: number, height: number): Promise<Raster> {
  const { data, info } = await sharp(buf).rotate().resize(width, height).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}
type RGB = [number, number, number];
function pixelsIn(r: Raster, b: Box, step = 1): RGB[] {
  const out: RGB[] = [];
  const x0 = Math.max(0, Math.floor(b.x0)), y0 = Math.max(0, Math.floor(b.y0)), x1 = Math.min(r.width, Math.ceil(b.x1)), y1 = Math.min(r.height, Math.ceil(b.y1));
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    const i = (y * r.width + x) * r.channels;
    out.push([r.data[i], r.data[i + 1], r.data[i + 2]]);
  }
  return out;
}
function two(pixels: RGB[]): { a: RGB; na: number; b: RGB; nb: number } {
  // 2-means split by luminance, a few iterations; enough to separate text from its background.
  const lum = (p: RGB) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  const sorted = [...pixels].sort((p, q) => lum(p) - lum(q));
  let ca = sorted[Math.floor(sorted.length * 0.1)], cb = sorted[Math.floor(sorted.length * 0.9)];
  let na = 0, nb = 0;
  for (let it = 0; it < 8; it++) {
    const sa = [0, 0, 0], sb = [0, 0, 0]; na = 0; nb = 0;
    for (const p of pixels) {
      const da = (p[0] - ca[0]) ** 2 + (p[1] - ca[1]) ** 2 + (p[2] - ca[2]) ** 2;
      const db = (p[0] - cb[0]) ** 2 + (p[1] - cb[1]) ** 2 + (p[2] - cb[2]) ** 2;
      if (da <= db) { sa[0] += p[0]; sa[1] += p[1]; sa[2] += p[2]; na++; } else { sb[0] += p[0]; sb[1] += p[1]; sb[2] += p[2]; nb++; }
    }
    if (na) ca = [sa[0] / na, sa[1] / na, sa[2] / na];
    if (nb) cb = [sb[0] / nb, sb[1] / nb, sb[2] / nb];
  }
  return { a: ca, na, b: cb, nb };
}
const hex = (p: RGB) => formatHex({ mode: "rgb", r: p[0] / 255, g: p[1] / 255, b: p[2] / 255 })!;

export interface TextContrast { text: string; fg: string; bg: string; ratio: number; needed: number; large: boolean; bbox: Box }

/** Contrast of each line of text, measured inside its own box: the text colour is the minority colour, the background the majority. */
export function measureTextContrast(r: Raster, lines: OcrLine[]): TextContrast[] {
  const out: TextContrast[] = [];
  for (const l of lines) {
    // measure word by word (tighter boxes), keep the worst word of the line
    let worst: TextContrast | null = null;
    for (const w of l.words) {
      const px = pixelsIn(r, w.bbox);
      if (px.length < 30) continue;
      const { a, na, b, nb } = two(px);
      const [fg0, bg] = na <= nb ? [a, b] : [b, a];
      // Anti-aliased edges blend text into the background; use the third of text pixels furthest from the background.
      const d2 = (p: RGB, q: RGB) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      const textPx = px.filter((p) => d2(p, fg0) < d2(p, bg)).sort((p, q) => d2(q, bg) - d2(p, bg));
      const core = textPx.slice(0, Math.max(1, Math.floor(textPx.length / 3)));
      const fg: RGB = core.length ? [core.reduce((s, p) => s + p[0], 0) / core.length, core.reduce((s, p) => s + p[1], 0) / core.length, core.reduce((s, p) => s + p[2], 0) / core.length] : fg0;
      const ratio = Math.round(wcagContrast(hex(fg), hex(bg)) * 10) / 10;
      const large = (w.bbox.y1 - w.bbox.y0) >= r.height * 0.045;
      const needed = large ? 3 : 4.5;
      const t: TextContrast = { text: l.text, fg: hex(fg), bg: hex(bg), ratio, needed, large, bbox: l.bbox };
      if (!worst || ratio / needed < worst.ratio / worst.needed) worst = t;
    }
    if (worst) out.push(worst);
  }
  return out;
}

// ---------- logo ----------
/** The approved logo: two greens, square (1:1), and the measurable parts of rule VI-3. */
export const LOGO_SPEC = { colours: ["#43BC54", "#1B5C3A"], aspect: 1, minWidthShare: 0.08, clearSpace: 0.25 };
const de = differenceCiede2000();

export interface LogoReport { box: Box; aspect: number; widthShare: number; colourDelta: number; mainColour: string; clearSpaceBusy: boolean; problems: string[] }

/** Checks a logo found in the image (box from the vision AI, or given by a test) against the approved logo. */
export function checkLogo(r: Raster, box: Box, textLines: OcrLine[]): LogoReport {
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  const aspect = Math.round((w / Math.max(1, h)) * 100) / 100;
  const widthShare = Math.round((w / r.width) * 1000) / 1000;
  // logo colours: the coloured pixels in the box (skip near-white/near-grey background)
  const px = pixelsIn(r, box, Math.max(1, Math.floor(Math.min(w, h) / 60))).filter((p) => Math.max(...p) - Math.min(...p) > 30);
  let mainColour = "#000000", colourDelta = 0;
  if (px.length > 20) {
    const { a, na, b, nb } = two(px);
    const cs = [a, b].filter((_, i) => (i === 0 ? na : nb) > px.length * 0.15);
    const deltas = cs.map((c) => Math.min(...LOGO_SPEC.colours.map((ref) => de(hex(c), ref))));
    colourDelta = Math.round(Math.max(...deltas) * 10) / 10;
    mainColour = hex(na >= nb ? a : b);
  }
  // clear space: no text box may enter the ring around the logo; the ring itself must be calm (low variation)
  const pad = w * LOGO_SPEC.clearSpace;
  const ring: Box = { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad };
  const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const textInRing = textLines.some((l) => /[A-Za-z]{3,}/.test(l.text) && overlaps(l.bbox, ring));
  const ringPx = [
    ...pixelsIn(r, { x0: ring.x0, y0: ring.y0, x1: ring.x1, y1: box.y0 }, 2),
    ...pixelsIn(r, { x0: ring.x0, y0: box.y1, x1: ring.x1, y1: ring.y1 }, 2),
    ...pixelsIn(r, { x0: ring.x0, y0: box.y0, x1: box.x0, y1: box.y1 }, 2),
    ...pixelsIn(r, { x0: box.x1, y0: box.y0, x1: ring.x1, y1: box.y1 }, 2),
  ];
  const lumStd = (() => { if (ringPx.length < 10) return 0; const l = ringPx.map((p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]); const m = l.reduce((s, v) => s + v, 0) / l.length; return Math.sqrt(l.reduce((s, v) => s + (v - m) ** 2, 0) / l.length); })();
  const clearSpaceBusy = textInRing || lumStd > 45;
  const problems: string[] = [];
  if (Math.abs(aspect - LOGO_SPEC.aspect) > 0.12) problems.push("stretched");
  if (colourDelta > 20) problems.push("recoloured");
  if (widthShare < LOGO_SPEC.minWidthShare) problems.push("too small");
  if (clearSpaceBusy) problems.push("no clear space");
  return { box, aspect, widthShare, colourDelta, mainColour, clearSpaceBusy, problems };
}

export function logoFindings(rep: LogoReport, ruleText: string): Finding[] {
  const msgs: Record<string, string> = {
    stretched: `The logo is ${rep.aspect > 1 ? "stretched wide" : "squashed"}: it is ${rep.aspect} times as wide as it is tall, but the approved logo is square.`,
    recoloured: `The logo's colours have been changed (its main colour is ${rep.mainColour}, which is not one of the logo's two greens).`,
    "too small": `The logo is only ${Math.round(rep.widthShare * 100)}% of the image width. It must be at least ${Math.round(LOGO_SPEC.minWidthShare * 100)}%.`,
    "no clear space": "Text or busy graphics are too close to the logo. Keep clear space of a quarter of the logo's width on every side.",
  };
  const titles: Record<string, string> = { stretched: "Logo is stretched", recoloured: "Logo is recoloured", "too small": "Logo is too small", "no clear space": "Logo has no clear space" };
  return rep.problems.map((p) => ({
    location: "image", category: "visual", severity: p === "too small" ? "minor" : "major", method: "code",
    title: titles[p], message: msgs[p], quote: undefined, suggestion: null,
    sources: [{ id: "VI-3", kind: "rule", text: ruleText }],
  }));
}

// ---------- privacy ----------
/**
 * Finds private text (personal data, confidential terms) in the OCR lines and returns boxes to hide.
 * We hide the whole line, not just the matched words, because OCR can misread or drop a word
 * (e.g. a currency sign or one digit group) and a partly hidden secret is still a leak.
 * A line also counts as private when it holds 2+ consecutive words of a confidential phrase,
 * or 8+ digits (phone, card, ID numbers that OCR may have split oddly).
 */
export function privateBoxes(lines: OcrLine[], canon: Canon): { boxes: Box[]; count: number } {
  const boxes: Box[] = [];
  let count = 0;
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  const phrases = (canon.confidential ?? []).map((c) => norm(c.phrase).split(" ").filter((w) => w.length > 1));
  for (const l of lines) {
    const red = redact(l.text, canon);
    const text = ` ${norm(l.text)} `;
    const partial = phrases.some((ws) => ws.length >= 2 && ws.some((w, i) => i < ws.length - 1 && text.includes(` ${w} ${ws[i + 1]} `)));
    const digits = (l.text.match(/\d/g) ?? []).length >= 8;
    if (!red.count && !partial && !digits) continue;
    count += Math.max(1, red.count);
    boxes.push(l.bbox);
  }
  return { boxes, count };
}

/** Returns a copy of the image with the given boxes blurred heavily, as JPEG. */
export async function blurBoxes(buf: Buffer, width: number, height: number, boxes: Box[]): Promise<Buffer> {
  const base = sharp(buf).rotate().resize(width, height).flatten({ background: "#ffffff" });
  if (!boxes.length) return base.jpeg({ quality: 85 }).toBuffer();
  const src = await base.png().toBuffer();
  const overlays = await Promise.all(boxes.map(async (b) => {
    const left = Math.max(0, Math.floor(b.x0 - 4)), top = Math.max(0, Math.floor(b.y0 - 4));
    const w = Math.min(width - left, Math.ceil(b.x1 - b.x0 + 8)), h = Math.min(height - top, Math.ceil(b.y1 - b.y0 + 8));
    // two separate steps: sharp keeps only the last resize() in one pipeline
    const tiny = await sharp(src).extract({ left, top, width: Math.max(1, w), height: Math.max(1, h) }).resize(Math.max(1, Math.round(w / 24)), 2, { fit: "fill" }).toBuffer();
    const input = await sharp(tiny).resize(Math.max(1, w), Math.max(1, h), { kernel: "nearest", fit: "fill" }).png().toBuffer();
    return { input, left, top };
  }));
  return sharp(src).composite(overlays).jpeg({ quality: 85 }).toBuffer();
}

export function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:image\/[a-z+]+;base64,(.+)$/);
  return m ? Buffer.from(m[1], "base64") : null;
}

export const fmtBox = (b: Box) => `${Math.round(b.x0)},${Math.round(b.y0)} ${Math.round(b.x1 - b.x0)}×${Math.round(b.y1 - b.y0)}`;
export { parse };
