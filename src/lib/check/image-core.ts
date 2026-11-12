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
export function analysePixels(data: ArrayLike<number>, channels: number, size: { width: number; height: number }, canon: Canon, opts: { hasText: boolean; altText: string | null | undefined; suggestedAlt?: string | null }): { report: ImageReport | null; findings: Finding[] } {
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += channels) pixels.push([data[i], data[i + 1], data[i + 2]]);
  const total = pixels.length;
  const palette = canon.palette.map((p) => ({ ...p, parsed: parse(p.hex)! }));
  const ON_BRAND_DE = 6; // CIEDE2000; above ~6 the colour difference is clearly visible

  // Per-pixel: is this pixel a brand colour (or a neutral like white/grey/black)?
  const cache = new Map<number, { onBrand: boolean; nearest: (typeof palette)[number]; d: number }>();
  const classify = (p: RGB) => {
    const key = ((p[0] >> 2) << 12) | ((p[1] >> 2) << 6) | (p[2] >> 2);
    const hit = cache.get(key);
    if (hit) return hit;
    const col = { mode: "rgb" as const, r: p[0] / 255, g: p[1] / 255, b: p[2] / 255 };
    let nearest = palette[0], best = Infinity;
    for (const pc of palette) { const d = de(col, pc.parsed); if (d < best) { best = d; nearest = pc; } }
    const chroma = toLch(col)?.c ?? 0;
    const r = { onBrand: chroma < 10 || best <= ON_BRAND_DE, nearest, d: best };
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
        message: `${hex} covers about ${Math.round(share * 100)}% of the image. Nearest brand colour: ${k.nearest?.name} ${k.nearest?.hex} (difference ΔE ${Math.round(k.d * 10) / 10}; above ${ON_BRAND_DE} is a visibly different colour).`,
        quote: hex, suggestion: k.nearest?.hex ?? null,
        sources: [{ id: "VI-1", kind: "rule", text: paletteText }],
      });
    }
  }

  // Estimated contrast: background = largest colour; likely text colours = light or dark neutrals.
  let contrast: ImageReport["contrast"];
  if (opts.hasText && colours.length > 1) {
    const bg = colours[0];
    const candidates = colours.slice(1).filter((c) => c.share >= 0.015 && c.share < 0.45);
    const textLike = candidates.filter((c) => { const l = toLch(parse(c.hex)!)?.l ?? 50; return l > 85 || l < 20; });
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
          message: `Estimated contrast ${contrast.ratio} : 1 between ${worst.fg.toUpperCase()} and the ${bg.hex.toUpperCase()} background. WCAG AA needs 4.5 : 1 for normal text (3 : 1 for large text). Use Ink #1D2129 text on Cream, or Cream text on Forest.`,
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
