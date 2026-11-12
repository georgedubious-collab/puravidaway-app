"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MAX_DOC_BYTES } from "@/lib/driverKyc";
import type { FormState } from "@/lib/forms/formState";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { addVehiclePhoto, attachDriverDocument, attachVehicleDocument } from "./actions";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

export type UploadTarget =
  | { type: "driver"; key: string }
  | { type: "vehicle"; vehicleId: string; key: string }
  | { type: "photo"; vehicleId: string };

/**
 * Uploads straight to the private bucket, into the driver's own folder, then
 * tells the server which document (or vehicle photo) the file is.
 */
export function DocumentUpload({
  userId,
  target,
  label,
  uploaded,
  renew,
  imageOnly,
  lang = "es",
}: {
  userId: string;
  target: UploadTarget;
  label: string;
  uploaded: boolean;
  /** Dated document after the first review: ask for its new date with the file. */
  renew?: { ask: string; kind: "date" | "year" };
  /** A photo only, no PDF (the licence plate photo). */
  imageOnly?: boolean;
  lang?: TeamLang;
}) {
  const t = makeT(lang);
  const [renewed, setRenewed] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const photos = target.type === "photo";
  const noPdf = photos || Boolean(imageOnly);
  const id = `up-${target.type}-${"vehicleId" in target ? target.vehicleId : "me"}-${"key" in target ? target.key : "photo"}`;

  async function uploadOne(file: File): Promise<string | null> {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const type = TYPES[ext];
    if (!type || (noPdf && type === "application/pdf")) {
      return noPdf
        ? t("Use fotos (JPG, PNG, WEBP, HEIC).", "Use photos (JPG, PNG, WEBP, HEIC).")
        : t("Use una foto (JPG, PNG, WEBP, HEIC) o un PDF.", "Use a photo (JPG, PNG, WEBP, HEIC) or a PDF.");
    }
    if (file.size > MAX_DOC_BYTES) return t(`${file.name} pesa más de 10 MB. Pruebe con una foto más pequeña.`, `${file.name} is over 10 MB. Try a smaller photo.`);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) return t("La subida de archivos todavía no está disponible.", "Uploads aren't available yet.");
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = photos ? `photo-${stamp}.${ext}` : `${target.key}-${stamp}.${ext}`;
    const path =
      target.type === "driver" ? `${userId}/${name}` : `${userId}/vehicles/${target.vehicleId}/${name}`;
    const { error } = await supabase.storage
      .from("driver-kyc-docs")
      .upload(path, file, { contentType: type, upsert: false });
    if (error) return t("La subida falló. Revise su conexión e intente de nuevo.", "Upload failed. Check your connection and try again.");

    let res: FormState;
    if (target.type === "driver") res = await attachDriverDocument(target.key, path, renew ? renewed : undefined);
    else if (target.type === "vehicle")
      res = await attachVehicleDocument(target.vehicleId, target.key, path, renew ? renewed : undefined);
    else res = await addVehiclePhoto(target.vehicleId, path);
    return res.error ?? null;
  }

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setMsg(null);
    if (renew && !renewed) {
      if (input.current) input.current.value = "";
      return setMsg({
        ok: false,
        text: t(`Primero escriba: ${renew.ask.toLowerCase()}.`, `Enter the ${renew.ask.toLowerCase()} first.`),
      });
    }
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const err = await uploadOne(file);
        if (err) {
          setMsg({ ok: false, text: err });
          return;
        }
      }
      setMsg({ ok: true, text:
          photos && files.length > 1
            ? t(`${files.length} fotos agregadas`, `${files.length} photos added`)
            : t("Subido", "Uploaded"),
      });
      setRenewed("");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
      startTransition(() => router.refresh());
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
        id={id}
        type="file"
        multiple={photos}
        accept={noPdf ? "image/*,.heic" : "image/*,.heic,application/pdf"}
        className="sr-only"
        onChange={(e) => onPick(e.target.files)}
        disabled={busy}
      />
      <label
        htmlFor={id}
        className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl px-4 text-sm font-bold ${
          uploaded
            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            : "bg-emerald-950 text-white hover:bg-emerald-900"
        } ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        <span className="sr-only">{label}: </span>
        {busy
          ? t("Subiendo…", "Uploading…")
          : photos
            ? t("Agregar fotos", "Add photos")
            : uploaded
              ? t("Reemplazar", "Replace")
              : t("Subir", "Upload")}
      </label>
      {msg && (
        <span aria-live="polite" className={`text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
