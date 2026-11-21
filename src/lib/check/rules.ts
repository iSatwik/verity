// Deterministic checks. Everything here is plain code: fast, free, repeatable and private.
// Each finding cites the exact rule / fact / term that it is based on.

import { type Canon, type Fact, type Product, factIsExpired, factNotStarted, todayISO } from "../canon";
import type { Finding, Severity, SourceRef } from "./types";

// ---------- helpers ----------

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a regex for a term variant. Spaces and hyphens are interchangeable. */
function variantRegex(variant: string): RegExp {
  const caseSensitive = variant.startsWith("=");
  const v = caseSensitive ? variant.slice(1) : variant;
  const body = escapeRe(v).replace(/(\\-|\s)+/g, "[\\s-]?");
  const startB = /^\w/.test(v) ? "\\b" : "";
  const endB = /\w$/.test(v) ? "\\b" : "";
  return new RegExp(`${startB}${body}${endB}`, caseSensitive ? "g" : "gi");
}

interface Sentence { text: string; start: number; end: number }
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    if (!raw.trim()) continue;
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    out.push({ text: t, start: m.index + lead, end: m.index + lead + t.length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}
/** The clause of a sentence around [from, to): split on commas, dashes and emojis. */
function clauseAround(s: Sentence, from: number, to: number): Sentence {
  const rel = s.text;
  const re = /[,;:\u2013\u2014]|\p{Extended_Pictographic}\uFE0F?/gu;
  let a = 0, b = rel.length, m: RegExpExecArray | null;
  const f = from - s.start, t = to - s.start;
  while ((m = re.exec(rel))) {
    if (m.index < f) a = m.index + m[0].length;
    else if (m.index >= t) { b = m.index; break; }
  }
  const raw = rel.slice(a, b);
  const lead = raw.length - raw.trimStart().length;
  const text = raw.trim();
  return { text, start: s.start + a + lead, end: s.start + a + lead + text.length };
}
function sentenceAt(sents: Sentence[], pos: number): Sentence | undefined {
  return sents.find((s) => pos >= s.start && pos <= s.end);
}

function ruleRef(canon: Canon, id: string): SourceRef {
  const r = canon.rules.find((x) => x.id === id);
  if (r) return { id, kind: "rule", text: r.body };
  const t = canon.terms.find((x) => x.id === id);
  if (t) return { id, kind: "term", text: t.note ?? `Use "${t.replacement ?? ""}" instead of ${t.variants.replace(/=/g, "").split("|").map((v) => `"${v}"`).join(", ")}` };
  return { id, kind: "rule", text: id };
}
function factRef(f: Fact): SourceRef {
  return { id: f.id, kind: "fact", text: f.statement };
}
function ruleSeverity(canon: Canon, id: string, fallback: Severity = "major"): Severity {
  const r = canon.rules.find((x) => x.id === id);
  return (r?.severity as Severity) ?? fallback;
}

const NUM_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const UNIT_DAYS: Record<string, number> = { minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30 };

function productMentions(text: string, products: Product[]): { product: Product; index: number }[] {
  const out: { product: Product; index: number }[] = [];
  for (const p of products) {
    const keys = [p.name, ...p.keywords.split("|")].filter(Boolean);
    for (const k of keys) {
      const re = new RegExp(`\\b${escapeRe(k).replace(/\s+/g, "[\\s-]?")}\\b`, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) out.push({ product: p, index: m.index });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}
let CONTEXT_TEXT = "";
function productFor(text: string, sents: Sentence[], products: Product[], pos: number): Product | undefined {
  const mentions = productMentions(text, products);
  if (!mentions.length) return CONTEXT_TEXT ? productMentions(CONTEXT_TEXT, products)[0]?.product : undefined;
  const s = sentenceAt(sents, pos);
  if (s) {
    const inSentence = mentions.filter((m) => m.index >= s.start && m.index <= s.end);
    if (inSentence.length) {
      // nearest mention to the position
      return inSentence.sort((a, b) => Math.abs(a.index - pos) - Math.abs(b.index - pos))[0].product;
    }
  }
  return mentions[0].product;
}

// Effect words, grouped, used to match a result claim to the right approved fact.
const EFFECT_GROUPS: string[][] = [
  ["acne", "blemish", "blemishes", "pimple", "pimples", "spots", "breakout", "breakouts", "clear", "clearer"],
  ["oily", "oil", "oiliness", "shine", "greasy"],
  ["even", "even-toned", "tone", "toned", "fair", "fairer", "fairness", "glow", "glowing", "bright", "brighter", "pigmentation"],
  ["redness", "red", "calm", "soothe", "soothes", "soothing", "irritation"],
  ["sunburn", "burn", "burns", "tan"],
  ["wrinkle", "wrinkles", "ageing", "aging", "lines"],
];
function effectGroups(s: string): Set<number> {
  const words = s.toLowerCase().match(/[a-z-]+/g) ?? [];
  const out = new Set<number>();
  for (const w of words) EFFECT_GROUPS.forEach((g, i) => { if (g.includes(w)) out.add(i); });
  return out;
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function fmtDays(d: number): string {
  if (d < 1 / 24) return `${Math.round(d * 1440)} minutes`;
  if (d < 1) return `${Math.round(d * 24)} hours`;
  if (d % 7 === 0 && d >= 7) return `${d / 7} week${d / 7 > 1 ? "s" : ""}`;
  return `${d} day${d > 1 ? "s" : ""}`;
}

// ---------- the checks ----------

/** contextText: other text from the same submission (e.g. the caption when checking image text), used to find which product is meant. */
export function runCodeChecks(canon: Canon, text: string, channel: string, location: "text" | "image" = "text", contextText = ""): Finding[] {
  CONTEXT_TEXT = contextText;
  const today = todayISO();
  const findings: Finding[] = [];
  const sents = sentences(text);
  const add = (f: Omit<Finding, "location" | "method"> & { start?: number; end?: number }) =>
    findings.push({ location, method: "code", ...f });

  // 1. Confidential terms
  for (const c of canon.confidential) {
    const re = new RegExp(escapeRe(c.phrase), "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      add({ category: "confidential", severity: "blocker", title: "Confidential information", message: `"${m[0]}" is on the confidential list${c.note ? ` (${c.note})` : ""}. Remove it before publishing. It was also masked before any AI check.`, quote: m[0], suggestion: "", sources: [ruleRef(canon, "CF-1"), { id: c.id, kind: "confidential", text: c.phrase }], start: m.index, end: m.index + m[0].length });
    }
  }

  // 2. Terminology (brand name, product names, banned phrases, preferred words)
  for (const t of canon.terms) {
    for (const variant of t.variants.split("|").filter(Boolean)) {
      const re = variantRegex(variant);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const start = m.index, end = start + m[0].length;
        if (findings.some((f) => f.start !== undefined && f.end !== undefined && start < f.end && end > f.start && f.category === "terminology")) continue;
        let replacement = t.replacement ?? null;
        if (t.id === "T-07") {
          const p = productFor(text, sents, canon.products, start);
          const ing = p && canon.facts.find((f) => f.product_id === p.id && f.kind === "ingredient" && f.suggested_copy && f.status === "active");
          replacement = ing?.suggested_copy ?? null;
        }
        if (t.id === "T-11") {
          const p = productFor(text, sents, canon.products, start);
          const tested = p && canon.facts.find((f) => f.product_id === p.id && f.kind === "tested");
          if (!tested) replacement = null;
        }
        const kindTitle: Record<string, string> = { brand_name: "Brand name written wrongly", product_name: "Wrong product name", banned: "Banned phrase", preferred: "Off-brand wording" };
        const isClaim = t.rule_id?.startsWith("C-") || ["T-09", "T-10", "T-11"].includes(t.id);
        const sources: SourceRef[] = [ruleRef(canon, t.id)];
        if (t.rule_id && t.rule_id !== t.id) sources.push(ruleRef(canon, t.rule_id));
        if (t.id === "T-07" && replacement) {
          const ing = canon.facts.find((f) => f.suggested_copy === replacement);
          if (ing) sources.push(factRef(ing));
        }
        add({
          category: isClaim ? "claims" : "terminology",
          severity: t.severity as Severity,
          title: kindTitle[t.kind] ?? "Terminology",
          message: t.kind === "product_name" || t.kind === "brand_name"
            ? `The approved name is "${t.replacement}".`
            : `${t.note ?? `"${m[0]}" is not allowed.`}${replacement ? ` Suggested: "${replacement}".` : ""}`,
          quote: m[0],
          suggestion: replacement === null ? null : replacement,
          sources,
          start, end,
        });
      }
    }
  }

  // 3. Result claims with a timeframe ("in 3 days", "overnight")
  const durRe = /\b(?:in|within|after)\s+(?:just\s+|only\s+)?(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(minute|hour|day|week|month)s?\b|\bovernight\b|\binstantly\b|\binstant results\b/gi;
  let dm: RegExpExecArray | null;
  while ((dm = durRe.exec(text))) {
    const s = sentenceAt(sents, dm.index);
    if (!s) continue;
    const lower = s.text.toLowerCase();
    if (/\b(?:deliver\w*|shipping|ships?|dispatch\w*|offers?|sale|ends|valid|returns?)\b/.test(lower)) continue;
    const stripNames = (x: string) => canon.products.reduce((acc, p) => acc.replace(new RegExp(escapeRe(p.name), "gi"), " "), x);
    const claimEffects = effectGroups(stripNames(s.text));
    const resultWords = /skin|acne|blemish|glow|result|clear|fair|redness|sunburn|spots|pimple|oil|tone|wrinkle|heal|repair|gone|goodbye/.test(lower);
    if (!resultWords) continue;
    let days: number;
    const w = dm[0].toLowerCase();
    if (w.includes("overnight")) days = 1;
    else if (w.includes("instant")) days = 0;
    else {
      const n = NUM_WORDS[dm[1].toLowerCase()] ?? Number(dm[1]);
      days = n * UNIT_DAYS[dm[2].toLowerCase()];
    }
    const product = productFor(text, sents, canon.products, dm.index);
    const candidates = canon.facts.filter((f) => f.kind === "result" && f.duration_days !== null && f.status === "active" && (!product || f.product_id === product.id));
    const scored = candidates
      .map((f) => ({ f, score: [...effectGroups(stripNames(f.statement))].filter((g) => claimEffects.has(g)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const best = scored[0]?.f;
    const claimed = dm[0].trim();
    const clause = clauseAround(s, dm.index, dm.index + dm[0].length);
    if (best && product) {
      if (days + 1e-9 >= (best.duration_days ?? 0) * 0.95 && !factIsExpired(best, today)) continue; // supported
      add({
        category: "claims",
        severity: "blocker",
        title: "Result claim not supported",
        message: `The post promises results ${claimed}. The approved fact ${best.id} says ${fmtDays(best.duration_days ?? 0)}: "${best.statement}"`,
        quote: clause.text,
        suggestion: best.suggested_copy ?? null,
        sources: [ruleRef(canon, "C-1.2"), ruleRef(canon, "C-1.1"), factRef(best)],
        start: clause.start, end: clause.end,
      });
    } else {
      add({
        category: "claims",
        severity: "blocker",
        title: "Unsupported result claim",
        message: `No approved fact supports this result${product ? ` for ${product.name}` : ""} ${claimed}. Remove the claim or add evidence to the brand rules first.`,
        quote: clause.text,
        suggestion: null,
        sources: [ruleRef(canon, "C-1.2"), ruleRef(canon, "C-1.1")],
        start: clause.start, end: clause.end,
      });
    }
  }

  // 4. Superlatives
  const supRe = /(?:\bindia'?s\s+)?(?:#\s?1|no\.\s?1\b|\bnumber one\b)(?:\s+[a-z][a-z-]*)?|(?:\bindia'?s\s+)?\b(?:best|most recommended|most trusted|leading|top-rated)\b|\b(?:india'?s|everyone'?s|the nation'?s|most)\s+(?:favourite|favorite)\b/gi;
  let sm: RegExpExecArray | null;
  while ((sm = supRe.exec(text))) {
    const start = sm.index, end = start + sm[0].length;
    const product = productFor(text, sents, canon.products, start);
    const tested = product && canon.facts.find((f) => f.product_id === product.id && f.kind === "tested" && f.status === "active" && !factIsExpired(f, today));
    const isDerm = /derm/i.test(sm[0]);
    const sources = [ruleRef(canon, "C-4.2")];
    if (tested && isDerm) sources.push(factRef(tested));
    const afterIs = /\bis\s+$/i.test(text.slice(Math.max(0, start - 4), start));
    const supSuggestion = tested && isDerm ? `${afterIs ? "a " : ""}${tested.suggested_copy}` : null;
    add({
      category: "claims",
      severity: ruleSeverity(canon, "C-4.2", "blocker"),
      title: "Superlative needs evidence",
      message: `"${sm[0]}" needs a current study or ranking on file, and none exists.${tested && isDerm ? ` You can say "${tested.suggested_copy}" instead (${tested.id}).` : " Remove it or attach evidence."} Routed to compliance.`,
      quote: sm[0],
      suggestion: supSuggestion,
      sources, start, end,
    });
  }

  // 5. Comparisons with other brands
  const cmpRe = /\b(?:unlike|compared to|better than)\b[^,.!?\n]*|\bother brands\b/gi;
  let cm: RegExpExecArray | null;
  while ((cm = cmpRe.exec(text))) {
    const start = cm.index, end = start + cm[0].length;
    if (findings.some((f) => f.title === "Comparison with other brands" && f.start !== undefined && f.end !== undefined && start < f.end && end > f.start)) continue;
    add({ category: "claims", severity: "blocker", title: "Comparison with other brands", message: "Comparisons with other brands are not allowed, and the brand voice never mocks competitors.", quote: cm[0], suggestion: null, sources: [ruleRef(canon, "C-4.1"), ruleRef(canon, "V-08")], start, end });
  }

  // 6. Numbers that must match facts (founded year, ingredient %, SPF, offer %)
  for (const f of canon.facts.filter((x) => x.check_pattern)) {
    let re: RegExp;
    try { re = new RegExp(f.check_pattern as string, "gi"); } catch { continue; }
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index, end = start + m[0].length;
      const got = m[1];
      if (f.status === "draft") {
        add({ category: "claims", severity: "blocker", title: "Claim relies on an unapproved fact", message: `${f.id} is still a draft with no proof attached.`, quote: m[0], suggestion: null, sources: [ruleRef(canon, "C-1.1"), factRef(f)], start, end });
      } else if (factIsExpired(f, today)) {
        add({ category: "facts", severity: "blocker", title: "Outdated offer or fact", message: `${f.id} expired on ${f.valid_until}: "${f.statement}"`, quote: m[0], suggestion: null, sources: [ruleRef(canon, "C-5.1"), factRef(f)], start, end });
      } else if (got !== undefined && f.check_value !== null && Number(got) !== Number(f.check_value)) {
        const fixed = m[0].replace(got, f.check_value);
        add({ category: "facts", severity: "blocker", title: "Number doesn't match the approved fact", message: `The text says ${got}, but ${f.id} says ${f.check_value}: "${f.statement}"`, quote: m[0], suggestion: fixed, sources: [ruleRef(canon, f.kind === "offer" ? "C-5.1" : "C-3.1"), factRef(f)], start, end });
      }
    }
  }

  // 7. Keyword facts (draft facts with no proof, expired facts)
  for (const f of canon.facts.filter((x) => x.keywords)) {
    const re = new RegExp(`\\b(?:100%\\s*)?(?:${(f.keywords as string).split("|").map(escapeRe).join("|")})\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index, end = start + m[0].length;
      if (f.status === "draft") {
        add({ category: "claims", severity: "blocker", title: "Claim needs evidence", message: `"${m[0]}" relies on ${f.id} ("${f.statement}"), which is a draft with no proof attached. Remove the claim or ask ${f.owner ?? "the owner"} to attach evidence.`, quote: m[0], suggestion: null, sources: [ruleRef(canon, "C-1.1"), factRef(f)], start, end });
      } else if (factIsExpired(f, today)) {
        add({ category: "facts", severity: "major", title: "Fact has expired", message: `${f.id} expired on ${f.valid_until}. Check it is still true before publishing.`, quote: m[0], suggestion: null, sources: [ruleRef(canon, "C-5.1"), factRef(f)], start, end });
      }
    }
  }

  // 8. Prices and delivery thresholds
  const priceRe = /(?:₹|\brs\.?\s?|\binr\s?)\s?(\d[\d,]*(?:\.\d+)?)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = priceRe.exec(text))) {
    const start = pm.index, end = start + pm[0].length;
    const amount = Number(pm[1].replace(/,/g, ""));
    const s = sentenceAt(sents, start);
    const isDelivery = s && /deliver|shipping/i.test(s.text);
    if (isDelivery) {
      const d = canon.facts.find((f) => f.kind === "delivery" && f.status === "active");
      if (d && d.price !== null && d.price !== amount) {
        add({ category: "facts", severity: "blocker", title: "Delivery terms don't match", message: `${d.id} says: "${d.statement}"`, quote: pm[0], suggestion: `₹${d.price}`, sources: [ruleRef(canon, "C-5.1"), factRef(d)], start, end });
      }
      continue;
    }
    const product = productFor(text, sents, canon.products, start);
    if (!product) {
      add({ category: "facts", severity: "major", title: "Price can't be matched to a product", message: "Mention which product this price is for, so it can be checked against the approved price list.", quote: pm[0], suggestion: null, sources: [ruleRef(canon, "C-5.1")], start, end });
      continue;
    }
    const prices = canon.facts.filter((f) => f.kind === "price" && f.product_id === product.id && f.status === "active");
    const current = prices.find((f) => !factIsExpired(f, today) && !factNotStarted(f, today));
    const exact = prices.find((f) => f.price === amount);
    if (exact && exact === current) continue;
    if (exact && factIsExpired(exact, today)) {
      add({ category: "facts", severity: "blocker", title: "Outdated price", message: `₹${amount} expired on ${exact.valid_until} (${exact.id}).${current ? ` The current approved price is ₹${current.price} (${current.id}).` : ""}`, quote: pm[0], suggestion: current ? `₹${current.price}` : null, sources: [ruleRef(canon, "C-5.1"), factRef(exact), ...(current ? [factRef(current)] : [])], start, end });
    } else {
      add({ category: "facts", severity: "blocker", title: "Price not in the approved price list", message: current ? `The approved price for ${product.name} is ₹${current.price} (${current.id}).` : `There is no current approved price for ${product.name}.`, quote: pm[0], suggestion: current ? `₹${current.price}` : null, sources: [ruleRef(canon, "C-5.1"), ...(current ? [factRef(current)] : [])], start, end });
    }
  }

  // 9. Offers need an end date and T&C
  const offerRe = /\b\d{1,2}\s?%\s*off\b|\bsale\b|\boffer\b|\bdiscount\b|\buse code\b/i;
  const offerSents = [...sents.filter((x) => /\d{1,2}\s?%\s*off/i.test(x.text)), ...sents.filter((x) => !/\d{1,2}\s?%\s*off/i.test(x.text))];
  for (const s of offerSents) {
    if (!offerRe.test(s.text)) continue;
    const all = text;
    const hasTnc = /t\s?&\s?c|terms (?:and|&) conditions|terms apply/i.test(all);
    const hasDate = /\b(?:ends?|till|until|valid (?:till|until))\b[^.!?]*\d|\b\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(all);
    if (hasTnc && hasDate) break;
    const offer = canon.facts.find((f) => f.kind === "offer" && f.status === "active" && !factIsExpired(f, today));
    const missing = [!hasDate && "an end date", !hasTnc && "\"T&C apply\""].filter(Boolean).join(" and ");
    // Only suggest a fix that actually satisfies the rule (otherwise accepting it would loop).
    const pct = /\d{1,2}\s?%\s*off/i.test(s.text);
    const ends = offer?.valid_until ? (() => { const d = new Date(String(offer.valid_until).slice(0, 10) + "T00:00:00Z"); return isNaN(+d) ? null : `Offer ends ${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}.`; })() : null;
    const built = [!hasDate && ends, !hasTnc && "T&C apply."].filter(Boolean).join(" ");
    const candidates = [pct && offer?.suggested_copy ? `${s.text} ${offer.suggested_copy}` : null, built ? `${s.text} ${built}` : null];
    const fixes = (c: string) => (hasTnc || /t\s?&\s?c|terms (?:and|&) conditions|terms apply/i.test(c)) && (hasDate || /\b(?:ends?|till|until|valid (?:till|until))\b[^.!?]*\d|\b\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(c));
    const suggestion = candidates.find((c): c is string => !!c && fixes(c)) ?? null;
    add({ category: "disclosure", severity: "major", title: "Offer is missing terms", message: `Offers must state ${missing}.${suggestion ? "" : " There is no approved end date for this offer, so add the date yourself."}`, quote: s.text, suggestion, sources: [ruleRef(canon, "C-5.2"), ruleRef(canon, "D-03"), ...(offer && /\d{1,2}\s?%\s*off/i.test(s.text) ? [factRef(offer)] : [])], start: s.start, end: s.end });
    break;
  }

  // 10. Paid-partnership disclosure
  const looksPaid = channel === "influencer" || (/@\w+/.test(text) && /use code|promo code|discount code/i.test(text));
  const discloseRe = /#ad\b|#sponsored|paid partnership/i;
  const opening = text.trim().slice(0, 60);
  if (location === "text" && looksPaid && discloseRe.test(text) && !discloseRe.test(opening)) {
    // disclosed, but buried at the end where people won't see it before "more"
    const m = text.match(discloseRe)!;
    const first = text.trim().split(/\s+/)[0] ?? "";
    const start = text.indexOf(first);
    add({ category: "disclosure", severity: "major", title: "Paid post disclosed too late", message: `"${m[0]}" appears only later in the post. Influencer or partner posts must start with "#ad" or "Paid partnership", so people see it before tapping "more".`, quote: first, suggestion: `#ad ${first}`, sources: [ruleRef(canon, "D-01")], start, end: start + first.length });
  }
  if (location === "text" && looksPaid && !discloseRe.test(text)) {
    const first = text.trim().split(/\s+/)[0] ?? "";
    const start = text.indexOf(first);
    add({ category: "disclosure", severity: "blocker", title: "Paid post not disclosed", message: "Influencer or partner posts must start with \"#ad\" or \"Paid partnership\".", quote: first, suggestion: `#ad ${first}`, sources: [ruleRef(canon, "D-01")], start, end: start + first.length });
  }

  // 11. Tone: pushy phrases, "!!", emojis, ALL CAPS
  const PUSHY: [RegExp, string][] = [
    [/\bgrab it now\b/gi, "Try it today"], [/\bbuy now\b/gi, "Shop now"], [/\border now\b/gi, "Order today"],
    [/\bhurry\b[!,]?/gi, ""], [/\blast chance\b/gi, "Ends soon"], [/\bdon'?t miss (?:out|this)\b/gi, ""],
    [/\bact fast\b/gi, ""], [/\bjaldi karo\b[!,]?/gi, ""], [/\bstock khatam\b[!]*/gi, ""], [/\blimited time only\b/gi, "For a limited time"], [/\bbefore it'?s gone\b/gi, ""],
  ];
  for (const [re, rep] of PUSHY) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const isCaps = m[0] === m[0].toUpperCase();
      add({ category: "tone", severity: ruleSeverity(canon, "V-02"), title: "Too pushy for the brand voice", message: `"${m[0]}" creates pressure. The voice rule says calm, never pushy${isCaps ? ", and no all-caps urgency" : ""}.`, quote: m[0], suggestion: rep, sources: [ruleRef(canon, "V-02")], start: m.index, end: m.index + m[0].length });
    }
  }
  if (location === "text") {
    const exRuns = [...text.matchAll(/!{2,}/g)];
    for (const m of exRuns) {
      add({ category: "tone", severity: ruleSeverity(canon, "V-02"), title: "Too many exclamation marks", message: "Use at most one \"!\" per post.", quote: m[0], suggestion: "!", sources: [ruleRef(canon, "V-02")], start: m.index, end: (m.index ?? 0) + m[0].length });
    }
    const totalEx = (text.match(/!+/g) ?? []).length;
    if (!exRuns.length && totalEx > 1) {
      const last = text.lastIndexOf("!");
      add({ category: "tone", severity: "minor", title: "More than one \"!\"", message: `This post has ${totalEx} exclamation marks. The rule allows one.`, quote: "!", suggestion: ".", sources: [ruleRef(canon, "V-02")], start: last, end: last + 1 });
    }
    const emojis = [...text.matchAll(/(?:\p{Extended_Pictographic}️?)+/gu)];
    const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
    if (emojiCount > 3) {
      const run = emojis.sort((a, b) => b[0].length - a[0].length)[0];
      const single = run[0].match(/\p{Extended_Pictographic}️?/u)?.[0] ?? "";
      add({ category: "tone", severity: ruleSeverity(canon, "V-02"), title: "Too many emojis", message: `${emojiCount} emojis. The voice rule allows three per post.`, quote: run[0], suggestion: single, sources: [ruleRef(canon, "V-02")], start: run.index, end: (run.index ?? 0) + run[0].length });
    }
    const ALLOW = new Set(["SPF", "PA", "AI", "UV", "MRP", "INR", "OK", "DIY", "CEO", "ASCI", "FAQ", "USA", "DM", "PH", "ML", "T&C", "TC"]);
    const capsRe = /\b[A-Z]{2,}(?:[\s:,]+[A-Z]{2,})*\b/g;
    let km: RegExpExecArray | null;
    while ((km = capsRe.exec(text))) {
      const words = km[0].split(/[\s:,]+/);
      if (words.every((w) => ALLOW.has(w)) || words.join("").length < 3) continue;
      const start = km.index, end = start + km[0].length;
      if (findings.some((f) => f.start !== undefined && f.end !== undefined && start < f.end && end > f.start)) continue;
      const s = sentenceAt(sents, start);
      const atStart = s && s.start === start;
      const lowered = km[0].toLowerCase();
      add({ category: "accessibility", severity: ruleSeverity(canon, "A-03", "minor"), title: "All caps", message: "Screen readers may spell out all-caps words, and it reads as shouting.", quote: km[0], suggestion: atStart ? capitalise(lowered) : lowered, sources: [ruleRef(canon, "A-03"), ruleRef(canon, "V-02")], start, end });
    }
  }

  // 11b. Personal contact details in public content
  if (channel !== "document") {
    const re = /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b|\b[\w.+-]+@(?:gmail|yahoo|hotmail|outlook|rediffmail)\.[a-z.]+\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      add({ category: "confidential", severity: ruleSeverity(canon, "CF-2", "major"), title: "Personal contact details", message: `"${m[0]}" looks like a personal phone number or email. Public content must use the brand's official support channel.`, quote: m[0], suggestion: "care@aranyanaturals.in", sources: [ruleRef(canon, "CF-2")], start: m.index, end: m.index + m[0].length });
    }
  }

  // 12. Hinglish outside Instagram
  if (location === "text" && ["email", "press", "website", "document", "linkedin"].includes(channel)) {
    const re = /\b(yaar|bahut|ekdum|kamaal|accha|achha|bindaas|jhakaas|arre|dekho)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      add({ category: "tone", severity: ruleSeverity(canon, "V-07", "minor"), title: "Hinglish in a formal channel", message: `"${m[0]}" is fine on Instagram or WhatsApp, but not in ${channel === "press" ? "a press release" : channel === "linkedin" ? "a LinkedIn post" : channel === "email" ? "an email" : `a ${channel}`}.`, quote: m[0], suggestion: null, sources: [ruleRef(canon, "V-07")], start: m.index, end: m.index + m[0].length });
    }
  }

  // 13. Link text
  if (location === "text") {
    const re = channel === "instagram" || channel === "influencer" ? /\bclick here\b/gi : /\bclick here\b|\blink in bio\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      add({ category: "accessibility", severity: ruleSeverity(canon, "A-02", "minor"), title: "Vague link text", message: "Say where the link goes. \"Click here\" means nothing to screen-reader users.", quote: m[0], suggestion: "Visit aranyanaturals.in", sources: [ruleRef(canon, "A-02")], start: m.index, end: m.index + m[0].length });
    }
  }

  // 14. Brand hashtag in CamelCase
  {
    const re = /#aranyanaturals\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      add({ category: "accessibility", severity: "minor", title: "Hashtag not in CamelCase", message: "Screen readers read CamelCase hashtags word by word.", quote: m[0], suggestion: "#AranyaNaturals", sources: [ruleRef(canon, "A-04")], start: m.index, end: m.index + m[0].length });
    }
  }

  // 15. Unproven popularity numbers
  {
    const re = /\b(?:loved|trusted|used|chosen) by (?:lakhs|millions|thousands|crores)(?: of \w+)?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      add({ category: "claims", severity: "minor", title: "Popularity claim needs a number on file", message: "There is no approved fact for customer numbers.", quote: m[0], suggestion: null, sources: [ruleRef(canon, "C-1.1")], start: m.index, end: m.index + m[0].length });
    }
  }

  // 16. Long sentences
  if (location === "text") {
    for (const s of sents) {
      const words = s.text.split(/\s+/).length;
      if (words > 30) add({ category: "tone", severity: "minor", title: "Long sentence", message: `${words} words. Short sentences are easier to read.`, quote: s.text, suggestion: null, sources: [ruleRef(canon, "V-05")], start: s.start, end: s.end });
    }
  }

  return dedupe(findings);
}

/** Remove findings fully inside another finding with the same title, and exact duplicates. */
function dedupe(list: Finding[]): Finding[] {
  const out: Finding[] = [];
  for (const f of list) {
    const dup = out.some((o) => o.title === f.title && o.quote === f.quote && o.start === f.start);
    if (!dup) out.push(f);
  }
  return out;
}
