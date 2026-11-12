export type Severity = "blocker" | "major" | "minor" | "advisory";
export type Category =
  | "terminology"
  | "claims"
  | "facts"
  | "tone"
  | "messaging"
  | "accessibility"
  | "disclosure"
  | "visual"
  | "confidential";
export type Method = "code" | "ai" | "ai_unverified";

export interface SourceRef {
  id: string;
  kind: "rule" | "fact" | "term" | "palette" | "confidential" | "wcag";
  text: string;
}

export interface Finding {
  location: "text" | "image";
  category: Category;
  severity: Severity;
  title: string;
  message: string;
  quote?: string; // exact text from the content this finding is about
  suggestion?: string | null; // replacement for `quote` (null = no automatic fix)
  sources: SourceRef[];
  method: Method;
  start?: number;
  end?: number;
}

export interface Intent {
  goal: string;
  audience: string;
  key_message: string;
  cta: string;
  by: "ai" | "auto";
}

export interface ImageReport {
  width: number;
  height: number;
  colours: { hex: string; share: number; nearest?: string; nearestHex?: string; deltaE?: number; onBrand: boolean }[];
  contrast?: { fg: string; bg: string; ratio: number };
  textSource?: "ai" | "creator";
}

export interface CheckInput {
  text: string;
  channel: string;
  imageData?: string | null; // data URL
  imageAlt?: string | null;
  imageText?: string | null;
}

export interface CheckResult {
  findings: Finding[];
  intent: Intent;
  imageReport: ImageReport | null;
  aiUsed: boolean;
  aiModel: string | null;
  redactions: number;
  notes: string[];
  detectedImageText?: string | null;
  suggestedAlt?: string | null;
}

export const SEVERITY_ORDER: Record<Severity, number> = { blocker: 0, major: 1, minor: 2, advisory: 3 };
