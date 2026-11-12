"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions";

const VARIANTS: Record<string, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 border-brand-500",
  secondary: "bg-white text-gray-800 hover:bg-gray-50 border-gray-300",
  danger: "bg-white text-red-700 hover:bg-red-50 border-red-200",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100 border-transparent",
};

export function ActionButton({
  action, children, variant = "secondary", confirm, className = "", small, disabled, title, onDone,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  confirm?: string;
  className?: string;
  small?: boolean;
  disabled?: boolean;
  title?: string;
  onDone?: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        title={title}
        disabled={pending || disabled}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setMsg(null);
          start(async () => {
            const r = await action();
            if (!r.ok) setMsg({ ok: false, text: r.error });
            else if (r.message) setMsg({ ok: true, text: r.message });
            onDone?.(r);
            router.refresh();
          });
        }}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${small ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm"} ${VARIANTS[variant]} ${className}`}
      >
        {pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {children}
      </button>
      {msg && <span role="status" className={`mt-1 max-w-xs text-xs ${msg.ok ? "text-brand-700" : "text-red-700"}`}>{msg.text}</span>}
    </span>
  );
}
