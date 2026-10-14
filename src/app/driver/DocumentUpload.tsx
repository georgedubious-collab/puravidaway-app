"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MAX_DOC_BYTES } from "@/lib/driverKyc";
import { attachDocument } from "./actions";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

/** Upload one KYC document straight to the private bucket, into the driver's own folder. */
export function DocumentUpload({
  userId,
  docKey,
  label,
  uploaded,
  renew,
}: {
  userId: string;
  docKey: string;
  label: string;
  uploaded: boolean;
  /** Renewable document (licence, insurance, Marchamo): ask for its new date with the file. */
  renew?: { ask: string; kind: "date" | "year" };
}) {
  const [renewed, setRenewed] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    if (renew && !renewed) {
      if (input.current) input.current.value = "";
      return setMsg({ ok: false, text: `Enter the ${renew.ask.toLowerCase()} first.` });
    }
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const type = TYPES[ext];
    if (!type) return setMsg({ ok: false, text: "Use a photo (JPG, PNG, WEBP, HEIC) or a PDF." });
    if (file.size > MAX_DOC_BYTES) return setMsg({ ok: false, text: "That file is over 10 MB. Try a smaller photo." });

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setMsg({ ok: false, text: "Uploads aren't available yet." });

    setBusy(true);
    try {
      const path = `${userId}/${docKey}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("driver-kyc-docs")
        .upload(path, file, { contentType: type, upsert: false });
      if (error) {
        setMsg({ ok: false, text: "Upload failed. Check your connection and try again." });
        return;
      }
      const res = await attachDocument(docKey, path, renew ? renewed : undefined);
      if (res.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setMsg({ ok: true, text: "Uploaded" });
      setRenewed("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {renew && (
        <label className="text-xs font-bold text-slate-600">
          {renew.ask}
          <input
            type={renew.kind === "year" ? "number" : "date"}
            inputMode={renew.kind === "year" ? "numeric" : undefined}
            min={renew.kind === "year" ? 2020 : undefined}
            max={renew.kind === "year" ? 2100 : undefined}
            value={renewed}
            onChange={(e) => setRenewed(e.target.value)}
            className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3 text-base font-normal sm:text-sm"
          />
        </label>
      )}
      <input
        ref={input}
        id={`doc-${docKey}`}
        type="file"
        accept="image/*,.heic,application/pdf"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0])}
        disabled={busy}
      />
      <label
        htmlFor={`doc-${docKey}`}
        className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl px-4 text-sm font-bold ${
          uploaded
            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            : "bg-emerald-950 text-white hover:bg-emerald-900"
        } ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        <span className="sr-only">{label}: </span>
        {busy ? "Uploading…" : uploaded ? "Replace" : "Upload"}
      </label>
      {msg && (
        <span aria-live="polite" className={`text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
