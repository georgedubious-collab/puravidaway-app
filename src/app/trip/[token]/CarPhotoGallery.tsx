"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicLang } from "@/lib/publicLang";

/**
 * The assigned car's photos on the trip page: a row that scrolls sideways (main photo first),
 * and a tap opens the photo full screen with previous / next. The links are short-lived
 * private ones signed by the server; only car photos ever reach this component.
 */
export function CarPhotoGallery({ photos, name, lang }: { photos: string[]; name: string; lang: PublicLang }) {
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const step = (by: number) => setOpen((i) => (i === null ? i : (i + by + photos.length) % photos.length));
  const label = (i: number) => t(`${name}, photo ${i + 1} of ${photos.length}`, `${name}, foto ${i + 1} de ${photos.length}`);

  return (
    <>
      <ul className="-mx-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1" aria-label={t("Car photos", "Fotos del vehículo")}>
        {photos.map((u, i) => (
          <li key={u} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              aria-label={t(`Enlarge ${label(i)}`, `Ampliar ${label(i)}`)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link */}
              <img src={u} alt="" className="h-28 w-40 rounded-lg object-cover sm:h-32 sm:w-48" />
            </button>
          </li>
        ))}
      </ul>
      {photos.length > 1 && (
        <p className="mt-1 text-xs text-emerald-900">{t("Swipe to see more · tap to enlarge", "Deslice para ver más · toque para ampliar")}</p>
      )}

      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-black/95 p-0 text-white backdrop:bg-black/80"
        aria-label={t("Car photos", "Fotos del vehículo")}
      >
        {open !== null && (
          <div className="flex h-full w-full flex-col" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
            <div className="flex items-center justify-between p-3">
              <p className="text-sm font-bold">{open + 1} / {photos.length}</p>
              <button type="button" onClick={() => setOpen(null)} className="rounded-full bg-white/15 p-2" aria-label={t("Close", "Cerrar")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link */}
              <img src={photos[open]} alt={label(open)} className="max-h-full max-w-full rounded-lg object-contain" />
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={() => step(-1)} className="absolute left-2 rounded-full bg-white/15 p-2" aria-label={t("Previous photo", "Foto anterior")}>
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button type="button" onClick={() => step(1)} className="absolute right-2 rounded-full bg-white/15 p-2" aria-label={t("Next photo", "Foto siguiente")}>
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>
            <p className="p-3 text-center text-sm">{name}</p>
          </div>
        )}
      </dialog>
    </>
  );
}
