// Confidential mode (basic): mask personal data and confidential terms before any text leaves the app.
import type { Canon } from "../canon";
import { escapeRe } from "./rules";

export interface Redaction { masked: string; map: Record<string, string>; count: number }

const PATTERNS: [string, RegExp][] = [
  ["EMAIL", /[\w.+-]+@[\w-]+\.[\w.-]+/g],
  ["PHONE", /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g],
  ["PAN", /\b[A-Z]{5}\d{4}[A-Z]\b/g],
  ["AADHAAR", /\b\d{4}\s?\d{4}\s?\d{4}\b/g],
  ["CARD", /\b(?:\d[ -]?){13,16}\b/g],
];

export function redact(text: string, canon: Canon): Redaction {
  let masked = text;
  const map: Record<string, string> = {};
  let n = 0;
  const swap = (label: string, re: RegExp) => {
    masked = masked.replace(re, (m) => {
      n += 1;
      const key = `[${label}_${n}]`;
      map[key] = m;
      return key;
    });
  };
  for (const c of canon.confidential) swap("CONFIDENTIAL", new RegExp(escapeRe(c.phrase), "gi"));
  for (const [label, re] of PATTERNS) swap(label, re);
  return { masked, map, count: n };
}

export function unmask(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  return out;
}
