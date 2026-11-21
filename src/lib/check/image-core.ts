// Visual identity checks for images (pure code, runs anywhere): dominant colours vs the brand palette, estimated text contrast, alt text.
// Pure code (sharp + culori), no AI needed.

import { differenceCiede2000, parse, wcagContrast, formatHex, converter } from "culori";
import type { Canon } from "../canon";
import type { Finding, ImageReport } from "./types";

const de = differenceCiede2000();
const toLch = converter("lch");

type RGB = [number, number, number];

function kmeans(pixels: RGB[], k: number, iters = 10): { c: RGB; n: number }[] {
  // deterministic init: spread across luminance-sorted pixels
  const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  let centers: RGB[] = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) / k) * sorted.length)]);
  let counts = new Array(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts = new Array(k).fill(0);
    for (const p of pixels) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const c = centers[j];
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      sums[best][0] += p[0]; sums[best][1] += p[1]; sums[best][2] += p[2]; counts[best]++;
    }
    centers = centers.map((c, j) => (counts[j] ? [sums[j][0] / counts[j], sums[j][1] / counts[j], sums[j][2] / counts[j]] : c) as RGB);
  }
  return centers.map((c, j) => ({ c, n: counts[j] })).filter((x) => x.n > 0);
}

const hexOf = (c: RGB) => formatHex({ mode: "rgb", r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 });

/** Works on raw pixels, so the same code runs on the server (sharp) and in a browser (canvas). */
export interface MeasuredLine { text: string; fg: string; bg: string; ratio: number; needed: number; large: boolean }
export function analysePixels(data: ArrayLike<number>, channels: number, size: { width: number; height: number }, canon: Canon, opts: { hasText: boolean; altText: string | null | undefined; suggestedAlt?: string | null; measured?: MeasuredLine[] }): { report: ImageReport | null; findings: Finding[] } {
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += channels) pixels.push([data[i], data[i + 1], data[i + 2]]);
  const total = pixels.length;
  const palette = canon.palette.map((p) => ({ ...p, parsed: parse(p.hex)! }));
  const ON_BRAND_DE = 6; // CIEDE2000; above ~6 the colour difference is clearly visible
  const SHADE_HUE = 20, SHADE_CHROMA = 15; // degrees of hue, LCh chroma units

  // Per-pixel: is this pixel a brand colour (or a neutral like white/grey/black)?
  const cache = new Map<number, { onBrand: boolean; nearest: (typeof palette)[number]; d: number }>();
  const classify = (p: RGB) => {
    const key = ((p[0] >> 2) << 12) | ((p[1] >> 2) << 6) | (p[2] >> 2);
    const hit = cache.get(key);
    if (hit) return hit;
    const col = { mode: "rgb" as const, r: p[0] / 255, g: p[1] / 255, b: p[2] / 255 };
    let nearest = palette[0], best = Infinity;
    for (const pc of palette) { const d = de(col, pc.parsed); if (d < best) { best = d; nearest = pc; } }
    const lch = toLch(col);
    const chroma = lch?.c ?? 0;
    // A tint or shade of a brand colour (same hue, lighter or darker, no more saturated) also counts, e.g. shading in product photos.
    const shade = chroma >= 10 && palette.some((pc) => {
      const pl = toLch(pc.parsed); if (!pl || (pl.c ?? 0) < 5) return false;
      let dh = Math.abs((lch?.h ?? 0) - (pl.h ?? 0)); dh = Math.min(dh, 360 - dh);
      return dh <= SHADE_HUE && chroma - (pl.c ?? 0) <= SHADE_CHROMA;
    });
    const r = { onBrand: chroma < 10 || best <= ON_BRAND_DE || shade, nearest, d: best };
    cache.set(key, r);
    return r;
  };
  const offPixels = pixels.filter((p) => !classify(p).onBrand);

  const clusters = kmeans(pixels, 6).sort((a, b) => b.n - a.n);
  const colours = clusters.map(({ c, n }) => {
    const hex = hexOf(c);
    const k = classify(c);
    return { hex, share: n / total, nearest: k.nearest?.name, nearestHex: k.nearest?.hex, deltaE: Math.round(k.d * 10) / 10, onBrand: k.onBrand };
  });

  const findings: Finding[] = [];
  const paletteText = canon.rules.find((r) => r.id === "VI-1")?.body ?? "Brand colours only.";
  if (offPixels.length / total >= 0.08) {
    for (const oc of kmeans(offPixels, 3).sort((a, b) => b.n - a.n)) {
      const share = oc.n / total;
      if (share < 0.08) continue;
      const k = classify(oc.c);
      const hex = hexOf(oc.c).toUpperCase();
      findings.push({
        location: "image", category: "visual", severity: "major", method: "code",
        title: "Colour not in the brand palette",
        message: `${cap(colourName(hex))} (${hex}) covers about ${Math.round(share * 100)}% of the image. It is not a brand colour or a shade of one. The closest brand colour is ${k.nearest?.name} (${k.nearest?.hex}).`,
        quote: hex, suggestion: k.nearest?.hex ?? null,
        sources: [{ id: "VI-1", kind: "rule", text: paletteText }],
      });
    }
  }

  // Estimated contrast: background = largest colour; likely text colours = light or dark neutrals.
  let contrast: ImageReport["contrast"];
  const vi4 = [{ id: "VI-4", kind: "rule" as const, text: canon.rules.find((r) => r.id === "VI-4")?.body ?? "" }, { id: "WCAG 1.4.3", kind: "wcag" as const, text: "Contrast (Minimum): at least 4.5:1 for normal text, 3:1 for large text." }];
  if (opts.measured && opts.measured.length) {
    // Measured per line of text (OCR boxes): exact, and it names the line that fails.
    const bad = opts.measured.filter((m) => m.ratio < m.needed).sort((a, b) => a.ratio / a.needed - b.ratio / b.needed);
    const worst = [...opts.measured].sort((a, b) => a.ratio / a.needed - b.ratio / b.needed)[0];
    contrast = { fg: worst.fg, bg: worst.bg, ratio: worst.ratio, measured: true };
    for (const m of bad.slice(0, 3)) {
      findings.push({
        location: "image", category: "visual", severity: "blocker", method: "code",
        title: "Text on the image is hard to read",
        message: `"${m.text.length > 50 ? m.text.slice(0, 50) + "…" : m.text}" is ${colourName(m.fg)} on ${colourName(m.bg)}: ${m.ratio} : 1, measured inside the text. ${m.large ? "Large text" : "Text this size"} needs at least ${m.needed} : 1. Use dark Ink text on Cream, or Cream text on Forest.`,
        quote: m.text, suggestion: null, sources: vi4,
      });
    }
  } else if (opts.hasText && colours.length > 1) {
    const bg = colours[0];
    const candidates = colours.slice(1).filter((c) => c.share >= 0.015 && c.share < 0.45);
    // Text is a light or dark neutral that stands apart from the background; shadows of the background's own colour are not text.
    const bgL = toLch(parse(bg.hex)!)?.l ?? 50;
    const textLike = candidates.filter((c) => { const l = toLch(parse(c.hex)!)?.l ?? 50; return (l > 80 || l < 25) && Math.abs(l - bgL) >= 30; });
    const pool = textLike.length ? textLike : candidates;
    let worst: { fg: string; ratio: number } | null = null;
    for (const c of pool) {
      const ratio = wcagContrast(parse(c.hex)!, parse(bg.hex)!);
      if (!worst || ratio < worst.ratio) worst = { fg: c.hex, ratio };
    }
    if (worst) {
      contrast = { fg: worst.fg, bg: bg.hex, ratio: Math.round(worst.ratio * 10) / 10 };
      if (worst.ratio < 4.5) {
        findings.push({
          location: "image", category: "visual", severity: "blocker", method: "code",
          title: "Text on the image is hard to read",
          message: `The ${colourName(worst.fg)} text on the ${colourName(bg.hex)} background is hard to read: about ${contrast.ratio} : 1, and it needs at least 4.5 : 1 (3 : 1 for very large text). Use dark Ink text on Cream, or Cream text on Forest.`,
          quote: `${worst.fg.toUpperCase()} on ${bg.hex.toUpperCase()}`, suggestion: null,
          sources: [{ id: "VI-4", kind: "rule", text: canon.rules.find((r) => r.id === "VI-4")?.body ?? "" }, { id: "WCAG 1.4.3", kind: "wcag", text: "Contrast (Minimum): at least 4.5:1 for normal text." }],
        });
      }
    }
  }

  if (!opts.altText || !opts.altText.trim()) {
    findings.push({
      location: "image", category: "accessibility", severity: "major", method: "code",
      title: "Missing alt text",
      message: "Screen-reader users get nothing without alt text. Describe the product and any text in the image.",
      quote: "(no alt text)", suggestion: opts.suggestedAlt ?? null,
      sources: [{ id: "A-01", kind: "rule", text: canon.rules.find((r) => r.id === "A-01")?.body ?? "" }],
    });
  }

  return {
    report: { width: size.width, height: size.height, colours: colours.map((c) => ({ ...c, share: Math.round(c.share * 1000) / 1000 })), contrast },
    findings,
  };
}

/** Plain words for a colour, e.g. "bright orange", "light grey", "dark green". */
export function colourName(hex: string): string {
  const c = toLch(parse(hex)!);
  const l = c?.l ?? 50, ch = c?.c ?? 0, h = c?.h ?? 0;
  if (ch >= 4 && ch < 16 && l > 85 && h > 55 && h < 115) return "cream";
  if (ch < 12) return l > 90 ? "white" : l > 70 ? "light grey" : l > 40 ? "grey" : l > 20 ? "dark grey" : "black";
  const hue = h < 20 || h >= 340 ? "pink" : h < 40 ? "red" : h < 75 ? "orange" : h < 105 ? "yellow" : h < 165 ? "green" : h < 220 ? "teal" : h < 300 ? "blue" : "purple";
  const prefix = l > 78 ? "light " : l < 35 ? "dark " : ch > 70 ? "bright " : "";
  return prefix + hue;
}
function cap(t: string) { return t.charAt(0).toUpperCase() + t.slice(1); }
