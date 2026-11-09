import { Compass, MessageCircle } from "lucide-react";
import Link from "next/link";
import { whatsAppLink } from "@/lib/cart";

/**
 * Shared look for the 404, error and global-error pages: storefront colours,
 * a way home, and a WhatsApp line to our team. No hooks, so it works in
 * server and client components alike.
 */
export function ErrorScreen({
  eyebrow,
  title,
  text,
  whatsAppMessage,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  whatsAppMessage: string;
  /** Optional extra button, e.g. "Try again". */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <header className="bg-emerald-950 text-white border-b border-emerald-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center text-emerald-950">
              <Compass className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="font-extrabold text-lg tracking-tight">PuraVidaWay</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm font-extrabold uppercase tracking-wider text-emerald-700">{eyebrow}</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">{text}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {action}
            <Link
              href="/"
              className="min-h-12 w-full sm:w-auto inline-flex items-center justify-center px-6 rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950"
            >
              Back to the trip builder
            </Link>
          </div>
          <p className="mt-8 text-sm text-slate-500">
            Need a hand?{" "}
            <a
              href={whatsAppLink(whatsAppMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-600 underline underline-offset-2"
            >
              <MessageCircle className="w-4 h-4" aria-hidden /> Message our team on WhatsApp
            </a>
          </p>
        </div>
      </main>

      <footer className="bg-emerald-950 text-emerald-200 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">PuraVidaWay · Costa Rica</div>
      </footer>
    </div>
  );
}
