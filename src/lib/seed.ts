import { seedRuleHistoryWith } from "./rule-history";
import "server-only";
import { rawQ } from "./db";
import { PRODUCTS, RULES, FACTS, TERMS, PALETTE, CONFIDENTIAL, SAMPLES } from "./seed-data";
import { CREATIVE_S01, CREATIVE_NEHA_ALOE, CREATIVE_NEHA_SUN } from "./sample-images";
import { USERS } from "./users";
import { createSubmission, runCheckFor, submitForReview, reviewDecision, acceptFix, findingsFor, getSubmission, type Q } from "./store";

const q: Q = rawQ;

export async function seedIfEmpty(): Promise<void> {
  const claimed = await q<{ key: string }>("INSERT INTO canon_meta (key, value) VALUES ('seeded', $1) ON CONFLICT (key) DO NOTHING RETURNING key", [new Date().toISOString()]);
  if (!claimed.length) return; // already seeded (or another instance is seeding)
  await seedCanon();
  await seedDemoSubmissions();
  await seedRuleHistory();
}

export async function seedRuleHistory() { await seedRuleHistoryWith(q); }

export async function seedCanon() {
  await q("INSERT INTO canon_meta (key, value) VALUES ('version', '1') ON CONFLICT (key) DO UPDATE SET value = '1'");
  for (const p of PRODUCTS) await q("INSERT INTO products (id, name, size, keywords) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING", [p.id, p.name, p.size, p.keywords]);
  for (const r of RULES) await q("INSERT INTO rules (id, category, title, body, do_example, dont_example, severity) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING", [r.id, r.category, r.title, r.body, r.do_example ?? null, r.dont_example ?? null, r.severity]);
  for (const f of FACTS) await q(
    "INSERT INTO facts (id, statement, product_id, kind, source, owner, valid_from, valid_until, status, suggested_copy, duration_days, price, check_pattern, check_value, keywords) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO NOTHING",
    [f.id, f.statement, f.product_id ?? null, f.kind, f.source, f.owner, f.valid_from ?? null, f.valid_until ?? null, f.status, f.suggested_copy ?? null, f.duration_days ?? null, f.price ?? null, f.check_pattern ?? null, f.check_value ?? null, f.keywords ?? null],
  );
  for (const t of TERMS) await q("INSERT INTO terms (id, kind, variants, replacement, rule_id, severity, note) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING", [t.id, t.kind, t.variants, t.replacement ?? null, t.rule_id, t.severity, t.note ?? null]);
  for (const c of PALETTE) await q("INSERT INTO palette (id, name, hex) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", [c.id, c.name, c.hex]);
  for (const c of CONFIDENTIAL) await q("INSERT INTO confidential_terms (id, phrase, note) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", [c.id, c.phrase, c.note]);
}

/** A few submissions so judges land on a living workspace, not an empty one. No AI calls at seed time. */
async function seedDemoSubmissions() {
  const rahul = USERS.find((u) => u.id === "u_rahul")!;
  const ritika = USERS.find((u) => u.id === "u_ritika")!;
  const neha = USERS.find((u) => u.id === "u_neha")!;
  const s = (k: string) => SAMPLES.find((x) => x.key === k)!;

  // 1. Approved and locked (shows the end of the workflow)
  const a = await createSubmission(q, rahul, { title: "Sunscreen teaser post", channel: "instagram", text: "Our team has something new on the way. Meanwhile, try our Sun Shield SPF 50 Gel with SPF 50, PA++++ and no white cast. ☀️" });
  await runCheckFor(q, a, rahul, { ai: false });
  await submitForReview(q, a, rahul);
  await reviewDecision(q, a, ritika, "approved", "Looks good. On brand and every claim is backed (F-09, F-10).");

  // 2. Waiting for the brand manager
  const b = await createSubmission(q, rahul, { title: s("S-04").title, channel: s("S-04").channel, text: s("S-04").text });
  await runCheckFor(q, b, rahul, { ai: false });
  await submitForReview(q, b, rahul);

  // 3. Influencer post, partly fixed: two fixes accepted, re-check pending
  const c = await createSubmission(q, rahul, { title: s("S-03").title, channel: s("S-03").channel, text: s("S-03").text });
  await runCheckFor(q, c, rahul, { ai: false });
  const sub = await getSubmission(q, c);
  const fs = await findingsFor(q, c, sub!.current_version);
  for (const f of fs.filter((x) => ["Paid post not disclosed", "Wrong product name"].includes(x.title))) await acceptFix(q, f.id, rahul);

  // 4. The main demo post with its image: lots to fix
  const d = await createSubmission(q, rahul, { title: s("S-01").title, channel: s("S-01").channel, text: s("S-01").text, imageData: CREATIVE_S01, imageAlt: "", imageText: s("S-01").imageText });
  await runCheckFor(q, d, rahul, { ai: false });

  // 5. Neha P. from a second agency (Glow Studio): her own two posts. Rahul can't see these, and she can't see his.
  for (const [k, img] of [["S-09", CREATIVE_NEHA_ALOE], ["S-10", CREATIVE_NEHA_SUN]] as const) {
    const x = s(k);
    const id = await createSubmission(q, neha, { title: x.title.replace(" (Glow Studio)", ""), channel: x.channel, text: x.text, imageData: img, imageAlt: x.imageAlt ?? "", imageText: "" });
    await runCheckFor(q, id, neha, { ai: false });
  }
}

/** Wipe everything and start again (button on the About page). */
export async function resetDemo() {
  for (const t of ["canon_meta", "products", "rules", "facts", "terms", "palette", "confidential_terms", "submissions", "versions", "checks", "findings", "comments", "approvals", "audit_events", "ai_calls", "rule_feedback", "false_alarms"]) {
    await q(`DELETE FROM ${t}`);
  }
  for (const seq of ["submissions_id_seq", "versions_id_seq", "checks_id_seq", "findings_id_seq", "comments_id_seq", "approvals_id_seq", "audit_events_id_seq", "ai_calls_id_seq"]) {
    await q(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
  }
  await seedIfEmpty();
}

/** Create the demo accounts (scrypt-hashed passwords) if they are missing. */
export async function ensureAccounts() {
  const { hashPassword } = await import("./auth");
  const { DEMO_PASSWORD } = await import("./users");
  const have = await q<{ id: string }>("SELECT id FROM accounts");
  for (const u of USERS) {
    if (have.some((h) => h.id === u.id)) continue;
    await q("INSERT INTO accounts (id, email, role, password_hash) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [u.id, u.email, u.role, hashPassword(DEMO_PASSWORD)]);
  }
}
