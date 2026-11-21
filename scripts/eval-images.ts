// Image checker test (Round 1 target: catch >= 90% of colour and contrast errors planted in 20 test images).
// Generates simple ad images with known problems, plus clean ones to count false alarms.
import sharp from "sharp";
import { seedCanon } from "./canon-from-seed";
import { analyseImage } from "../src/lib/check/image";
import { ocrImage, raster, measureTextContrast, checkLogo, type Box } from "../src/lib/check/vision";
import fs from "fs";

const canon = seedCanon();
const FOREST = "#2E6B3F", CREAM = "#F4EFE2", INK = "#1D2129", SAFFRON = "#E8772E";
type Case = { name: string; bg: string; fg: string; colourErr: boolean; contrastErr: boolean };
const cases: Case[] = [
  // off-brand background, readable text (colour error only)
  { name: "neon orange", bg: "#FF5A1F", fg: "#111111", colourErr: true, contrastErr: false },
  { name: "hot pink (white, large text, 4.05 : 1 ≥ 3 : 1)", bg: "#F5136B", fg: "#FFFFFF", colourErr: true, contrastErr: false },
  { name: "purple", bg: "#6B2FBF", fg: "#FFFFFF", colourErr: true, contrastErr: false },
  { name: "bright blue", bg: "#1E6BFF", fg: "#FFFFFF", colourErr: true, contrastErr: false },
  { name: "yellow", bg: "#FFD400", fg: "#111111", colourErr: true, contrastErr: false },
  { name: "red", bg: "#D7261E", fg: "#FFFFFF", colourErr: true, contrastErr: false },
  // brand background, unreadable text (contrast error only)
  { name: "cream on cream-grey", bg: CREAM, fg: "#C9C3B4", colourErr: false, contrastErr: true },
  { name: "forest on dark", bg: FOREST, fg: "#3E7F50", colourErr: false, contrastErr: true },
  { name: "saffron on cream", bg: CREAM, fg: "#F0A060", colourErr: false, contrastErr: true },
  { name: "light grey on cream", bg: CREAM, fg: "#D8D8D8", colourErr: false, contrastErr: true },
  { name: "cream on saffron", bg: SAFFRON, fg: "#F4C9A8", colourErr: false, contrastErr: true },
  { name: "ink on forest", bg: FOREST, fg: "#2A3A30", colourErr: false, contrastErr: true },
  // both
  { name: "yellow on orange", bg: "#FF6A00", fg: "#FFD27A", colourErr: true, contrastErr: true },
  { name: "white on pink", bg: "#FF8FB8", fg: "#FFFFFF", colourErr: true, contrastErr: true },
  { name: "cyan on lime", bg: "#9BE15D", fg: "#C8F7F0", colourErr: true, contrastErr: true },
  { name: "grey on lavender", bg: "#C7B8F5", fg: "#E9E3FF", colourErr: true, contrastErr: true },
  // clean controls
  { name: "cream on forest", bg: FOREST, fg: CREAM, colourErr: false, contrastErr: false },
  { name: "ink on cream", bg: CREAM, fg: INK, colourErr: false, contrastErr: false },
  { name: "forest on cream", bg: CREAM, fg: FOREST, colourErr: false, contrastErr: false },
  { name: "ink on saffron", bg: SAFFRON, fg: INK, colourErr: false, contrastErr: false },
];
const svg = (c: Case) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${c.bg}"/>
<text x="40" y="170" font-family="Inter" font-weight="800" font-size="78" fill="${c.fg}">Clearer skin,</text>
<text x="40" y="260" font-family="Inter" font-weight="800" font-size="78" fill="${c.fg}">naturally.</text>
<text x="40" y="340" font-family="Inter" font-weight="600" font-size="34" fill="${c.fg}">Neem Purifying Cleanser, 100 ml</text>
<text x="40" y="390" font-family="Inter" font-weight="600" font-size="34" fill="${c.fg}">Visibly fewer blemishes in 4 weeks</text></svg>`;

const MODE = process.argv[2] ?? "measured";
(async () => {
  console.log(`Contrast mode: ${MODE}`);
  let planted = 0, caught = 0, falseAlarms = 0, cleanChecks = 0;
  for (const c of cases) {
    const buf = await sharp(Buffer.from(svg(c))).jpeg({ quality: 88 }).toBuffer();
    const url = "data:image/jpeg;base64," + buf.toString("base64");
    const ocr = await ocrImage(buf);
    const measured = ocr.lines.length ? measureTextContrast(await raster(buf, ocr.width, ocr.height), ocr.lines) : undefined;
    const r = await analyseImage(url, canon, { hasText: true, altText: "Ad", measured: MODE === "estimate" ? undefined : measured });
    const titles = r.findings.map((f) => f.title);
    const gotColour = titles.includes("Colour not in the brand palette");
    const gotContrast = titles.includes("Text on the image is hard to read");
    for (const [want, got] of [[c.colourErr, gotColour], [c.contrastErr, gotContrast]] as const) {
      if (want) { planted++; if (got) caught++; } else { cleanChecks++; if (got) falseAlarms++; }
    }
    console.log(`${c.name.padEnd(22)} colour ${c.colourErr ? "planted" : "clean  "} → ${gotColour ? "flagged" : "-"}   contrast ${c.contrastErr ? "planted" : "clean  "} → ${gotContrast ? "flagged" : "-"}`);
  }
  console.log(`\nPlanted errors caught: ${caught}/${planted} = ${Math.round((100 * caught) / planted)}%   False alarms: ${falseAlarms}/${cleanChecks}`);

  // ---- Logo checks (the box is given, as the vision AI would return it) ----
  const logo = fs.readFileSync("public/brand-aranya-logo.png");
  type L = { name: string; w: number; h: number; x: number; y: number; tint?: number; crowd?: boolean; bg?: string; want: string[] };
  const L: L[] = [
    { name: "correct", w: 110, h: 110, x: 460, y: 30, want: [] },
    { name: "correct on forest", w: 100, h: 100, x: 470, y: 470, bg: FOREST, want: [] },
    { name: "correct large", w: 160, h: 160, x: 400, y: 400, want: [] },
    { name: "stretched wide", w: 170, h: 100, x: 400, y: 30, want: ["stretched"] },
    { name: "squashed tall", w: 80, h: 130, x: 480, y: 30, want: ["stretched"] },
    { name: "recoloured red", w: 110, h: 110, x: 460, y: 30, tint: 220, want: ["recoloured"] },
    { name: "recoloured blue", w: 110, h: 110, x: 460, y: 30, tint: 120, want: ["recoloured"] },
    { name: "too small", w: 30, h: 30, x: 540, y: 30, want: ["too small"] },
    { name: "text too close", w: 100, h: 100, x: 358, y: 135, crowd: true, want: ["no clear space"] },
    { name: "stretched + small", w: 40, h: 22, x: 530, y: 30, want: ["stretched", "too small"] },
  ];
  let lp = 0, lc = 0, lf = 0, lclean = 0;
  for (const c of L) {
    let lg = sharp(logo).resize(c.w, c.h, { fit: "fill" });
    if (c.tint) lg = lg.modulate({ hue: c.tint });
    const lgBuf = await lg.png().toBuffer();
    const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${c.bg ?? CREAM}"/><text x="40" y="${c.crowd ? 200 : 300}" font-family="Inter" font-weight="800" font-size="52" fill="${c.bg ? CREAM : INK}">Clearer skin</text></svg>`;
    const buf = await sharp(Buffer.from(bgSvg)).composite([{ input: lgBuf, left: c.x, top: c.y }]).jpeg({ quality: 90 }).toBuffer();
    const ocr = await ocrImage(buf);
    const r0 = await raster(buf, ocr.width, ocr.height);
    const s = ocr.width / 600;
    const box: Box = { x0: c.x * s, y0: c.y * s, x1: (c.x + c.w) * s, y1: (c.y + c.h) * s };
    const rep = checkLogo(r0, box, ocr.lines);
    for (const p of ["stretched", "recoloured", "too small", "no clear space"]) {
      const want = c.want.includes(p), got = rep.problems.includes(p);
      if (want) { lp++; if (got) lc++; } else { lclean++; if (got) lf++; }
    }
    console.log(`${c.name.padEnd(20)} want [${c.want.join(", ")}] got [${rep.problems.join(", ")}]  aspect ${rep.aspect} width ${Math.round(rep.widthShare * 100)}% ΔE ${rep.colourDelta}`);
  }
  console.log(`\nLogo problems caught: ${lc}/${lp}   False alarms: ${lf}/${lclean}`);
  process.exit(0);
})();
