"use client";

import { useActionState, useRef, useState } from "react";
import { createAndCheck, extractFileText, type ActionResult } from "@/app/actions";
import { CHANNELS } from "@/lib/labels";
import { Card, Label } from "./ui";

interface Sample { key: string; title: string; channel: string; text: string; image: string | null; imageText: string; hint: string }

async function fileToDataUrl(file: Blob, maxSide = 1200): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  } finally { URL.revokeObjectURL(url); }
}

export function NewSubmissionForm({ samples }: { samples: Sample[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createAndCheck, null);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("instagram");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string>("");
  const [imageText, setImageText] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  async function loadSample(s: Sample) {
    setTitle(s.title); setChannel(s.channel); setText(s.text); setImageText(s.imageText); setImageAlt(""); setFileMsg(null);
    if (s.image) {
      const blob = await (await fetch(s.image)).blob();
      setImage(await fileToDataUrl(blob));
    } else setImage("");
  }

  async function onDoc(file: File) {
    setReading(true); setFileMsg(null);
    const fd = new FormData(); fd.append("file", file);
    const r = await extractFileText(fd);
    setReading(false);
    if (r.error) { setFileMsg(r.error); return; }
    setText(r.text ?? "");
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    setChannel((c) => (c === "instagram" ? "document" : c));
    setFileMsg(`Read ${file.name}: ${(r.text ?? "").split(/\s+/).filter(Boolean).length} words.`);
  }

  return (
    <form action={formAction} className="space-y-5">
      <Card className="p-5">
        <Label>Quick start: load a sample from the fictional brand</Label>
        <div className="flex flex-wrap gap-2">
          {samples.map((s) => (
            <button type="button" key={s.key} onClick={() => loadSample(s)} className="rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-brand-500 hover:bg-brand-50">
              <span className="font-medium">{s.title}</span>
              <span className="block text-xs text-gray-500">{s.hint}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <label className="block text-sm">
            <span className="font-medium">Title</span>
            <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali sale email" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Where will it be published?</span>
            <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2">
              {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="flex items-center justify-between font-medium">
            <span>Text content</span>
            <span className="flex items-center gap-2 text-xs font-normal text-gray-500">
              {reading && "Reading…"}
              <button type="button" onClick={() => docRef.current?.click()} className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50">Upload .docx / .pdf / .txt</button>
              <input ref={docRef} type="file" accept=".docx,.pdf,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && onDoc(e.target.files[0])} />
            </span>
          </span>
          <textarea name="text" value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder="Paste a caption, ad copy, email or press release…" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-[inherit] leading-relaxed" />
          {fileMsg && <span className="text-xs text-gray-600">{fileMsg}</span>}
        </label>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Image (optional)</p>
            <p className="text-xs text-gray-500">Checked for brand colours, text contrast and alt text. The words in the image are checked like the caption.</p>
          </div>
          <div className="flex gap-2">
            {image && <button type="button" onClick={() => setImage("")} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">Remove</button>}
            <button type="button" onClick={() => imgRef.current?.click()} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">{image ? "Replace image" : "Add image"}</button>
            <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await fileToDataUrl(f)); }} />
          </div>
        </div>
        {image && (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Preview of the uploaded image" className="h-44 w-44 rounded-lg border border-gray-200 object-cover" />
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="font-medium">Text in the image</span>
                <span className="ml-1 text-xs text-gray-500">(if AI is on, Verity reads it automatically when this is empty)</span>
                <textarea name="imageText" value={imageText} onChange={(e) => setImageText(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Alt text</span>
                <input name="imageAlt" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} placeholder="Describe the image for screen readers" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
            </div>
          </div>
        )}
        <input type="hidden" name="imageData" value={image} />
      </Card>

      {state && !state.ok && <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
          {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          {pending ? "Checking against the Brand Canon…" : "Run brand check"}
        </button>
        <span className="text-xs text-gray-500">Nothing is published. Your content is only checked and saved as a draft.</span>
      </div>
    </form>
  );
}
