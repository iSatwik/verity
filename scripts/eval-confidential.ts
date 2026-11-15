// Confidential-mode test (Round 1 target: zero "canary" words in anything sent to the AI).
// Builds the exact prompt that would be sent for each post and searches it for canaries.
import { seedCanon } from "./canon-from-seed";
import { redact } from "../src/lib/check/redact";
import { buildPrompt } from "../src/lib/check/ai";
import { runCodeChecks } from "../src/lib/check/rules";
import { SAMPLES } from "../src/lib/seed-data";

const canon = seedCanon();
const canaries = ["Project Kesar", "Nykaa exclusive deal", "₹189 cost price", "priya.sharma@example.com", "98765 43210", "+91 91234 56789", "ABCDE1234F", "1234 5678 9012", "4111 1111 1111 1111"];
const posts: string[] = [
  ...SAMPLES.map((s) => s.text),
  "Sneak peek: Project Kesar is coming in Feb! Our saffron oil.",
  "Big news, our NYKAA EXCLUSIVE DEAL starts soon. Neem Purifying Cleanser at ₹349.",
  "Internal: ₹189 cost price, sell at ₹349. Don't share.",
  "Questions? Write to priya.sharma@example.com or call 98765 43210.",
  "Order on WhatsApp +91 91234 56789. PAN ABCDE1234F for invoices.",
  "Customer Aadhaar 1234 5678 9012 verified, paid with 4111 1111 1111 1111.",
  "project kesar launch + nykaa exclusive deal, all in one post",
  "Mixed: Project Kesar, priya.sharma@example.com, 98765 43210 and ₹189 cost price.",
  "Aloe Calm Gel soothes skin. Ask us at priya.sharma@example.com.",
  "Our Rose Glow Toner (Project Kesar team's favourite) is back.",
];
let sent = 0, leaks = 0, masked = 0;
for (const text of posts) {
  const r = redact(text, canon);
  masked += r.count;
  const prompt = buildPrompt(r.masked, "instagram", canon, runCodeChecks(canon, text, "instagram"), r.map);
  sent++;
  for (const c of canaries) if (prompt.toLowerCase().includes(c.toLowerCase())) { leaks++; console.log("LEAK:", c, "in post:", text.slice(0, 60)); }
}
console.log(`posts: ${posts.length}, prompts built: ${sent}, values masked: ${masked}, canary leaks: ${leaks}`);
