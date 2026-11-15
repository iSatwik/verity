// Image checker test (Round 1 target: catch >= 90% of colour and contrast errors planted in 20 test images).
// Generates simple ad images with known problems, plus clean ones to count false alarms.
import sharp from "sharp";
import { seedCanon } from "./canon-from-seed";
import { analyseImage } from "../src/lib/check/image";

const canon = seedCanon();
const FOREST = "#2E6B3F", CREAM = "#F4EFE2", INK = "#1D2129", SAFFRON = "#E8772E";
type Case = { name: string; bg: string; fg: string; colourErr: boolean; contrastErr: boolean };
const cases: Case[] = [
  // off-brand background, readable text (colour error only)
  { name: "neon orange", bg: "#FF5A1F", fg: "#111111", colourErr: true, contrastErr: false },
  { name: "hot pink (white text is 4.05 : 1)", bg: "#F5136B", fg: "#FFFFFF", colourErr: true, contrastErr: true },
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

(async () => {
  let planted = 0, caught = 0, falseAlarms = 0, cleanChecks = 0;
  for (const c of cases) {
    const buf = await sharp(Buffer.from(svg(c))).jpeg({ quality: 88 }).toBuffer();
    const url = "data:image/jpeg;base64," + buf.toString("base64");
    const r = await analyseImage(url, canon, { hasText: true, altText: "Ad" });
    const titles = r.findings.map((f) => f.title);
    const gotColour = titles.includes("Colour not in the brand palette");
    const gotContrast = titles.includes("Text on the image is hard to read");
    for (const [want, got] of [[c.colourErr, gotColour], [c.contrastErr, gotContrast]] as const) {
      if (want) { planted++; if (got) caught++; } else { cleanChecks++; if (got) falseAlarms++; }
    }
    console.log(`${c.name.padEnd(22)} colour ${c.colourErr ? "planted" : "clean  "} → ${gotColour ? "flagged" : "-"}   contrast ${c.contrastErr ? "planted" : "clean  "} → ${gotContrast ? "flagged" : "-"}`);
  }
  console.log(`\nPlanted errors caught: ${caught}/${planted} = ${Math.round((100 * caught) / planted)}%   False alarms: ${falseAlarms}/${cleanChecks}`);
})();
