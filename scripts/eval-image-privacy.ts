// Private words inside images: does anything readable reach the AI?
// Each test image has a "canary" (a confidential term, email, phone number or card number) written on it.
// We run the same steps as the real pipeline (OCR, find private words, blur them), then read the blurred
// image again with OCR. A canary that can still be read would have leaked to the vision AI.
// Run: npm run eval:image-privacy
import sharp from "sharp";
import { ocrImage, privateBoxes, blurBoxes } from "../src/lib/check/vision";
import { CONFIDENTIAL } from "../src/lib/seed-data";

const canon = { confidential: CONFIDENTIAL, rules: [], facts: [], terms: [], palette: [], products: [], version: 1 } as never;
const cases: { name: string; line: string; canary: string; bg: string; fg: string }[] = [
  { name: "codename", line: "Coming soon: Project Kesar", canary: "kesar", bg: "#f5efe6", fg: "#1b5c3a" },
  { name: "partner deal", line: "Nykaa exclusive deal inside", canary: "nykaa", bg: "#ffffff", fg: "#222222" },
  { name: "cost price", line: "Only ₹189 cost price", canary: "189", bg: "#1b5c3a", fg: "#ffffff" },
  { name: "email", line: "Write to priya.sharma@gmail.com", canary: "priya", bg: "#fff8e7", fg: "#333333" },
  { name: "phone", line: "Call 98765 43210 today", canary: "43210", bg: "#ffffff", fg: "#1b5c3a" },
  { name: "card number", line: "Card 4111 1111 1111 1111", canary: "4111", bg: "#eef4ff", fg: "#111111" },
  // clean images: nothing should be hidden
  { name: "clean: price", line: "Now ₹349 for 100 ml", canary: "", bg: "#ffffff", fg: "#1b5c3a" },
  { name: "clean: claim", line: "Fewer blemishes in 4 weeks", canary: "", bg: "#f5efe6", fg: "#222222" },
  { name: "clean: date", line: "Offer ends 30 Nov 2026", canary: "", bg: "#ffffff", fg: "#333333" },
];
const img = (c: (typeof cases)[number]) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="${c.bg}"/>
<text x="40" y="140" font-family="Inter" font-weight="800" font-size="56" fill="${c.fg}">Neem Purifying Cleanser</text>
<text x="40" y="260" font-family="Inter" font-weight="600" font-size="44" fill="${c.fg}">${c.line}</text>
<text x="40" y="380" font-family="Inter" font-weight="600" font-size="40" fill="${c.fg}">Gentle on oily skin</text></svg>`);

async function main() {
  let leaks = 0, found = 0, keptOther = 0, falseBlur = 0;
  const secret = cases.filter((c) => c.canary).length, clean = cases.length - secret;
  for (const c of cases) {
    const buf = await sharp(img(c)).png().toBuffer();
    const ocr = await ocrImage(buf);
    const { boxes, count } = privateBoxes(ocr.lines, canon);
    const blurred = await blurBoxes(buf, ocr.width, ocr.height, boxes);
    const after = await ocrImage(blurred);
    const text = after.lines.map((l) => l.text).join(" ").toLowerCase();
    if (!c.canary) {
      const ok = count === 0;
      if (!ok) falseBlur++;
      console.log(`${ok ? "ok  " : "FALSE BLUR"}  ${c.name.padEnd(14)} hidden ${count}`);
      continue;
    }
    const leaked = text.includes(c.canary.toLowerCase());
    const other = /cleanser/i.test(text);
    if (count) found++;
    if (leaked) leaks++;
    if (other) keptOther++;
    console.log(`${leaked ? "LEAK" : "ok  "}  ${c.name.padEnd(14)} found ${count} · after blur reads: "${after.lines.map((l) => l.text).join(" | ").slice(0, 90)}"`);
  }
  console.log(`\nPrivate words found: ${found}/${secret} · readable after blurring (leaks): ${leaks} · other text still readable: ${keptOther}/${secret} · clean images wrongly blurred: ${falseBlur}/${clean}`);
  process.exit(leaks || falseBlur ? 1 : 0);
}
main();
