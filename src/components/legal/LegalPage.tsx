import { Compass, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { LegalLinks } from "./LegalLinks";

/** Date shown on every legal page; change it whenever the wording changes. */
export const LEGAL_LAST_UPDATED = "2026-11-08";

/** Where the law expects the operator's legal identity. Fill in after the lawyer's review. */
export const LEGAL_ENTITY_PLACEHOLDER = "[Legal company name, cédula jurídica and address — to be added]";

/**
 * Shared layout for /terms, /privacy and /cancellation (server component).
 * The draft notice stays until a Costa Rican lawyer has reviewed the text.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-950 flex items-center justify-center text-amber-400">
              <Compass className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">PuraVidaWay</span>
          </Link>
          <Link
            href="/"
            className="min-h-11 inline-flex items-center px-4 rounded-xl bg-emerald-950 text-white text-sm font-bold"
          >
            Plan a trip
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <p
          role="note"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900"
        >
          <TriangleAlert className="w-5 h-5 shrink-0 text-amber-600" aria-hidden />
          Draft — pending legal review. This text may change before it becomes final.
        </p>

        <h1 className="mt-6 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated {LEGAL_LAST_UPDATED}</p>
        {intro && <div className="mt-4 text-base text-slate-700 leading-relaxed">{intro}</div>}

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-slate-700 [&_a]:font-semibold [&_a]:text-emerald-700 [&_a:hover]:underline [&_li]:mt-1.5 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_p+p]:mt-3">
          {children}
        </div>
      </main>

      <footer className="bg-emerald-950 text-emerald-200 text-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-x-4">
          <p>PuraVidaWay · Costa Rica</p>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}

/** One numbered section of a legal page. */
export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6">
      <h2 id={`${id}-h`} className="text-xl font-extrabold text-slate-900">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
