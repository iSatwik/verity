// Small, client-safe constants.
export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  needs_fixes: "Needs fixes",
  ready: "Ready to submit",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const CHANNELS: Record<string, string> = {
  instagram: "Instagram post",
  influencer: "Influencer post",
  ad: "Advertisement",
  email: "Email",
  website: "Website copy",
  press: "Press release",
  whatsapp: "WhatsApp broadcast",
  linkedin: "LinkedIn post",
  document: "Document",
};

export const DISMISS_REASONS = ["False positive", "Rule is unclear", "Approved exception", "Fact is outdated", "Other"];

/** What each channel means and what Verity checks for it (shown while creating a submission). */
export const CHANNEL_GUIDE: Record<string, { what: string; checks: string[]; approvers: string }> = {
  instagram: { what: "A caption for the brand's own Instagram.", checks: ["Calm brand voice: at most one “!” and three emojis", "Claims, prices and offers match approved facts", "Correct product names, no banned words, CamelCase hashtags"], approvers: "Brand manager (and compliance if it makes claims)" },
  influencer: { what: "A post by a creator the brand pays.", checks: ["Must start with “#ad” or “Paid partnership”", "Claims and prices match approved facts", "Brand voice and product names"], approvers: "Brand manager and compliance" },
  ad: { what: "A paid ad: social, search, print or outdoor.", checks: ["Every claim, price and offer against approved facts", "Offers need an end date and “T&C apply”", "“#1”, “best” and similar need proof on file"], approvers: "Brand manager and compliance" },
  email: { what: "A newsletter or promotional email.", checks: ["Formal channel: no Hinglish", "Clear link text, no “click here”", "Claims, prices and offers against facts"], approvers: "Brand manager (and compliance if it makes claims)" },
  website: { what: "Product page or other website text.", checks: ["Formal channel: no Hinglish", "Clear link text: no “click here” or “link in bio”", "Claims, prices and ingredient numbers against facts"], approvers: "Brand manager (and compliance if it makes claims)" },
  press: { what: "A news announcement for journalists.", checks: ["Formal: no Hinglish, no pushy tone", "Every number and claim against approved facts", "No confidential names (unreleased products)"], approvers: "Brand manager and compliance" },
  whatsapp: { what: "A broadcast message to customers on WhatsApp.", checks: ["Hinglish is fine here", "No personal phone numbers or emails", "Prices and offers against approved facts"], approvers: "Brand manager (and compliance if it makes claims)" },
  linkedin: { what: "A post on the brand's or an employee's LinkedIn.", checks: ["Formal: no Hinglish", "No confidential names (unreleased products, deals)", "Correct brand name"], approvers: "Brand manager" },
  document: { what: "A Word or PDF file, like a brochure or script.", checks: ["Formal: no Hinglish", "Claims, prices and numbers against facts", "No confidential names"], approvers: "Brand manager (and compliance if it makes claims)" },
};
