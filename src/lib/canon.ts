// Loads the Brand Canon (rules, facts, terms, palette, confidential terms) from the database.

export interface Product { id: string; name: string; size: string | null; keywords: string }
export interface Rule { id: string; category: string; title: string; body: string; do_example: string | null; dont_example: string | null; severity: string }
export interface Fact {
  id: string; statement: string; product_id: string | null; kind: string; source: string | null; owner: string | null;
  valid_from: string | null; valid_until: string | null; status: string; suggested_copy: string | null;
  duration_days: number | null; price: number | null; check_pattern: string | null; check_value: string | null; keywords: string | null;
}
export interface Term { id: string; kind: string; variants: string; replacement: string | null; rule_id: string | null; severity: string; note: string | null }
export interface PaletteColour { id: string; name: string; hex: string }
export interface ConfidentialTerm { id: string; phrase: string; note: string | null }

export interface Canon {
  version: number;
  products: Product[];
  rules: Rule[];
  facts: Fact[];
  terms: Term[];
  palette: PaletteColour[];
  confidential: ConfidentialTerm[];
}

type QueryFn = <T>(text: string, params?: unknown[]) => Promise<T[]>;

function toDateStr(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadCanonWith(query: QueryFn): Promise<Canon> {
  const [meta, products, rules, facts, terms, palette, confidential] = await Promise.all([
    query<{ value: string }>("SELECT value FROM canon_meta WHERE key = 'version'"),
    query<Product>("SELECT * FROM products ORDER BY id"),
    query<Rule>("SELECT * FROM rules ORDER BY id"),
    query<Record<string, unknown>>("SELECT * FROM facts ORDER BY id"),
    query<Term>("SELECT * FROM terms ORDER BY id"),
    query<PaletteColour>("SELECT * FROM palette ORDER BY id"),
    query<ConfidentialTerm>("SELECT * FROM confidential_terms ORDER BY id"),
  ]);
  return {
    version: Number(meta[0]?.value ?? 1),
    products,
    rules: sortIds(rules),
    facts: sortIds(
      facts.map((f) => ({
        ...(f as unknown as Fact),
        valid_from: toDateStr(f.valid_from),
        valid_until: toDateStr(f.valid_until),
        duration_days: toNum(f.duration_days),
        price: toNum(f.price),
      })),
    ),
    terms: sortIds(terms),
    palette,
    confidential,
  };
}

/** Sort IDs like V-02, C-1.1, C-4.2, F-12 naturally. */
export function sortIds<T extends { id: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function todayISO(): string {
  // India time, since the demo brand works in IST.
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function factIsExpired(f: Fact, today = todayISO()): boolean {
  return Boolean(f.valid_until && f.valid_until < today);
}
export function factNotStarted(f: Fact, today = todayISO()): boolean {
  return Boolean(f.valid_from && f.valid_from > today);
}
export function factState(f: Fact, today = todayISO()): "active" | "expired" | "draft" | "upcoming" | "expiring" {
  if (f.status === "draft") return "draft";
  if (factIsExpired(f, today)) return "expired";
  if (factNotStarted(f, today)) return "upcoming";
  if (f.valid_until) {
    const days = (Date.parse(f.valid_until) - Date.parse(today)) / 86400000;
    if (days <= 14) return "expiring";
  }
  return "active";
}
