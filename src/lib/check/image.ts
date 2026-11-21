// Server-side image loading with sharp; the checks themselves are in image-core.ts.
import sharp from "sharp";
import type { Canon } from "../canon";
import type { Finding, ImageReport } from "./types";
import { analysePixels } from "./image-core";

export async function analyseImage(dataUrl: string, canon: Canon, opts: { hasText: boolean; altText: string | null | undefined; suggestedAlt?: string | null; measured?: import("./image-core").MeasuredLine[] }): Promise<{ report: ImageReport | null; findings: Finding[] }> {
  const m = dataUrl.match(/^data:image\/[a-z+]+;base64,(.+)$/);
  if (!m) return { report: null, findings: [] };
  const img = sharp(Buffer.from(m[1], "base64"));
  const meta = await img.metadata();
  const { data, info } = await img.resize(96, 96, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return analysePixels(data, info.channels, { width: meta.width ?? 0, height: meta.height ?? 0 }, canon, opts);
}
