// Seeded review history for the fictional demo brand (Round 3, Rule health).
import { normQuote } from "./rule-health";

/** 30 days of past review decisions for the demo brand (fictional), so Rule health has something to learn from.
 *  Three rules are planted as vague on purpose: V-04, M-03 and V-01. The test (npm run eval:rules) checks they are found. */
export const PLANTED_VAGUE = ["V-04", "M-03", "V-01"];
export async function seedRuleHistoryWith(q: (text: string, params?: unknown[]) => Promise<unknown[]>) {
  type H = [rule: string, kind: string, quote: string, note?: string];
  const rows: H[] = [];
  const add = (rule: string, kind: string, quote: string, note?: string, times = 1) => { for (let i = 0; i < times; i++) rows.push([rule, kind, quote, note]); };
  // clear, well-understood rules: warnings are almost always accepted
  add("C-1.2", "accepted", "Say goodbye to acne in just 3 days!", "See visibly fewer blemishes in 4 weeks of regular use.", 6);
  add("C-1.2", "accepted", "glowing skin overnight", "glowing skin in 4 weeks", 3);
  add("T-02", "accepted", "Neem Face Wash", "Neem Purifying Cleanser", 7);
  add("C-5.1", "accepted", "₹299", "₹349", 5);
  add("V-02", "accepted", "Grab it NOW", "Try it today", 5);
  add("V-02", "dismissed", "Shop now!", "One exclamation mark is allowed.", 1);
  add("C-4.2", "accepted", "India's #1", "dermatologically tested", 4);
  add("D-01", "accepted", "Loving my new cleanser", "#ad Loving my new cleanser", 4);
  add("T-07", "accepted", "100% chemical-free", "95% plant-derived", 4);
  add("V-07", "accepted", "ekdum mast", "really good", 3);
  add("V-07", "exception", "Shubh Diwali", "Festival greeting, approved by the brand manager.", 1);
  // planted vague rules: people disagree on what they mean
  add("V-04", "unclear", "Hey gorgeous!", "Is 'gorgeous' friendly or casual?", 3);
  add("V-04", "false_positive", "Hi there,", "This is friendly, not casual.", 2);
  add("V-04", "accepted", "Hey babes", "Hi there,", 1);
  add("V-04", "dismissed", "Guess what?", "Fine for Instagram.", 1);
  add("M-03", "unclear", "affordable luxury", "Does this break 'premium but accessible'?", 2);
  add("M-03", "dismissed", "starting at ₹349", "Price mention is not off-brand.", 2);
  add("M-03", "false_positive", "worth every rupee", "This is accessible, not cheap.", 1);
  add("M-03", "accepted", "cheap and cheerful", "gentle on skin and on budgets", 1);
  add("V-01", "unclear", "Let's be real about acne", "Is this honest or too blunt?", 2);
  add("V-01", "false_positive", "We get it, breakouts are annoying.", "Warm and honest.", 2);
  add("V-01", "accepted", "Dear valued customer", "Hi,", 1);
  add("V-01", "dismissed", "Here's the science bit", "Clear enough.", 1);
  const now = Date.now();
  for (let i = 0; i < rows.length; i++) {
    const [rule, kind, quote, note] = rows[i];
    const at = new Date(now - (30 - (i * 29) / rows.length) * 86400000).toISOString();
    await q("INSERT INTO rule_feedback (rule_id, kind, quote, note, user_id, created_at) VALUES ($1,'flagged',$2,NULL,'u_rahul',$3)", [rule, quote, at]);
    await q("INSERT INTO rule_feedback (rule_id, kind, quote, note, user_id, created_at) VALUES ($1,$2,$3,$4,$5,$6)", [rule, kind, quote, note ?? null, kind === "exception" ? "u_ritika" : "u_rahul", at]);
    if (kind === "false_positive") await q("INSERT INTO false_alarms (rule_id, quote_norm, quote, created_by, created_at) VALUES ($1,$2,$3,'u_rahul',$4) ON CONFLICT (rule_id, quote_norm) DO NOTHING", [rule, normQuote(quote), quote, at]);
  }
}
