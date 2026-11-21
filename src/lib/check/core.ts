// Pure helpers shared by the server pipeline and the browser demo.
import { sentences } from "./rules";
import type { Finding, Intent } from "./types";

const AUDIENCE: Record<string, string> = {
  instagram: "Instagram followers, 18–35",
  influencer: "The influencer's followers",
  ad: "People seeing a paid ad",
  email: "Newsletter subscribers",
  website: "Website visitors",
  press: "Journalists and media",
  whatsapp: "Past customers on WhatsApp",
  linkedin: "Professionals and job seekers on LinkedIn",
  document: "Readers of the document",
};

export function autoIntent(text: string, channel: string): Intent {
  const body = text.replace(/^subject:.*$/im, "").trim();
  const sents = sentences(body);
  const ctaRe = /\b(buy|shop|try|grab|order|use code|get|click|visit|sign up|book)\b/i;
  const cta = sents.find((s) => ctaRe.test(s.text))?.text ?? "";
  const goal = /buy|shop|order|grab|₹|price|off\b|sale|code/i.test(text) ? "Drive purchases" : /announce|launch|today/i.test(text) ? "Announce news" : "Build awareness";
  const key = sents.find((s) => s.text !== cta)?.text ?? sents[0]?.text ?? "";
  return { goal, audience: AUDIENCE[channel] ?? "General audience", key_message: key.slice(0, 160), cta: cta.slice(0, 120) || "None", by: "auto" };
}


export function riskTier(findings: Finding[], channel: string): "standard" | "claims" {
  if (["influencer", "ad", "press"].includes(channel)) return "claims";
  return findings.some((f) => f.category === "claims" || f.category === "facts" || f.category === "disclosure" || f.category === "confidential") ? "claims" : "standard";
}
