import Link from "next/link";

/** Terms · Privacy · Cancellation policy, for every footer. No hooks, so client and server pages can use it. */
export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cancellation", label: "Cancellation policy" },
] as const;

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap items-center gap-x-1 ${className}`}>
      {LEGAL_LINKS.map((l, i) => (
        <span key={l.href} className="inline-flex items-center gap-x-1">
          {i > 0 && <span aria-hidden>·</span>}
          <Link href={l.href} className="inline-flex min-h-11 items-center font-semibold hover:underline">
            {l.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
