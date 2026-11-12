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
  document: "Document",
};

export const DISMISS_REASONS = ["False positive", "Rule is unclear", "Approved exception", "Fact is outdated", "Other"];
