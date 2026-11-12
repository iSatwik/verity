import { PRODUCTS, RULES, FACTS, TERMS, PALETTE, CONFIDENTIAL } from "../src/lib/seed-data";
import type { Canon } from "../src/lib/canon";
export function seedCanon(): Canon {
  return {
    version: 1,
    products: PRODUCTS.map((p) => ({ ...p, size: p.size })),
    rules: RULES.map((r) => ({ ...r, do_example: r.do_example ?? null, dont_example: r.dont_example ?? null })),
    facts: FACTS.map((f) => ({ id: f.id, statement: f.statement, product_id: f.product_id ?? null, kind: f.kind, source: f.source, owner: f.owner, valid_from: f.valid_from ?? null, valid_until: f.valid_until ?? null, status: f.status, suggested_copy: f.suggested_copy ?? null, duration_days: f.duration_days ?? null, price: f.price ?? null, check_pattern: f.check_pattern ?? null, check_value: f.check_value ?? null, keywords: f.keywords ?? null })),
    terms: TERMS.map((t) => ({ ...t, replacement: t.replacement ?? null, note: t.note ?? null })),
    palette: PALETTE,
    confidential: CONFIDENTIAL.map((c) => ({ ...c, note: c.note ?? null })),
  };
}
