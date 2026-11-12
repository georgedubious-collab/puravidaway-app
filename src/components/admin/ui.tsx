/**
 * The admin's shared look (approved design, 2026-11-12): page headings, cards, chips, tables,
 * buttons, form fields and empty / error states. No hooks, so server and client components can
 * both use them. Colours follow the mockup: page #F4F6F4, ink #14231C, muted #5F6F67,
 * lines #E3E8E5, emerald #047857, dark menu #0B2E22, amber #F5B301.
 */
import Link from "next/link";
import type { Tone } from "@/lib/adminBookings";

/* ---------- Class names (for plain elements that need the same look) ---------- */

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]";

export const btn = {
  primary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#047857] px-4 text-sm font-extrabold text-white hover:bg-[#065F46] disabled:opacity-50 ${focus}`,
  secondary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCE3DF] bg-white px-4 text-sm font-bold text-[#14231C] hover:bg-[#F1F4F2] disabled:opacity-50 ${focus}`,
  danger: `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-4 text-sm font-extrabold text-white hover:bg-[#991B1B] disabled:opacity-50 ${focus}`,
  small: `inline-flex min-h-9 items-center justify-center rounded-lg bg-[#047857] px-3 text-xs font-extrabold text-white hover:bg-[#065F46] ${focus}`,
};

export const field = {
  label: "block text-sm font-bold text-[#33443C]",
  input:
    "mt-1 block w-full min-h-11 rounded-xl border border-[#DCE3DF] bg-white px-3 text-sm font-normal text-[#14231C] focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-[#047857]/20 disabled:bg-[#F1F4F2] disabled:text-[#5F6F67]",
  textarea:
    "mt-1 block w-full rounded-xl border border-[#DCE3DF] bg-white p-3 text-sm font-normal text-[#14231C] focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-[#047857]/20",
  hint: "mt-1 block text-xs font-normal text-[#5F6F67]",
};

export const link = "font-bold text-[#047857] underline-offset-2 hover:text-[#065F46] hover:underline";

/* ---------- Layout ---------- */

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  back,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {back && (
        <Link href={back.href} className={`inline-flex min-h-9 items-center gap-1 text-sm ${link}`}>
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-0 flex-[1_1_320px]">
          {eyebrow && <p className="font-mono text-sm font-bold text-[#5F6F67]">{eyebrow}</p>}
          <h1 className="text-2xl font-extrabold tracking-tight text-[#14231C] sm:text-[26px]">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-[#5F6F67]">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className = "",
  padded = true,
  id,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** false for tables and lists that run edge to edge. */
  padded?: boolean;
  id?: string;
}) {
  return (
    <section aria-labelledby={title && id ? id : undefined} className={`overflow-hidden rounded-2xl border border-[#E3E8E5] bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF1EE] px-4 py-3.5 sm:px-5">
          {title && (
            <h2 id={id} className="text-base font-extrabold text-[#14231C]">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children !== undefined && <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>}
    </section>
  );
}

/** A small heading + muted note above a group of cards (pricing page). */
export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <h2 className="text-lg font-extrabold text-[#14231C]">{title}</h2>
      {note && <p className="mt-0.5 text-sm leading-relaxed text-[#5F6F67]">{note}</p>}
    </div>
  );
}

/* ---------- Chips ---------- */

const TONES: Record<Tone, string> = {
  green: "bg-[#D1FAE5] text-[#065F46]",
  amber: "bg-[#FEF3C7] text-[#92400E]",
  orange: "bg-[#FFEDD5] text-[#9A3412]",
  blue: "bg-[#DBEAFE] text-[#1E40AF]",
  grey: "bg-[#F1F4F2] text-[#33443C]",
  red: "bg-[#FEE2E2] text-[#991B1B]",
};

export function Chip({ tone = "grey", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Round count badge (amber, as in the side menu). */
export function CountBadge({ n, tone = "amber" }: { n: number; tone?: "amber" | "red" | "grey" }) {
  const c = tone === "red" ? "bg-[#FEE2E2] text-[#991B1B]" : tone === "grey" ? "bg-[#F1F4F2] text-[#5F6F67]" : "bg-[#F5B301] text-[#3A2A00]";
  return <span className={`inline-flex min-w-[22px] justify-center rounded-full px-1.5 py-px text-xs font-extrabold ${c}`}>{n}</span>;
}

/* ---------- Tables ---------- */

/** Scrolls sideways on phones instead of squashing the columns. */
export function DataTable({ children, minWidth = 720, caption }: { children: React.ReactNode; minWidth?: number; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = "", align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`bg-[#FAFBFA] px-3 py-3 text-xs font-bold uppercase tracking-wide text-[#5F6F67] first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "", align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <td className={`border-t border-[#EDF1EE] px-3 py-3 align-top first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${align === "right" ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}

/** Label / value pairs (booking and driver details). */
export function DetailList({ children, cols = 1 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <dl className={`grid gap-x-4 gap-y-2.5 text-sm ${cols === 2 ? "grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_1fr]" : "grid-cols-[minmax(7rem,auto)_1fr]"}`}>
      {children}
    </dl>
  );
}

export function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  const empty = v === null || v === undefined || v === "" || v === false;
  return (
    <>
      <dt className="text-[#5F6F67]">{k}</dt>
      <dd className="break-words font-semibold text-[#14231C]">{empty ? "—" : v}</dd>
    </>
  );
}

/* ---------- States ---------- */

export function EmptyState({ title, text, action }: { title: string; text?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-[#F1F4F2] text-[#5F6F67]">
        <Icon name="inbox" />
      </span>
      <p className="font-extrabold text-[#14231C]">{title}</p>
      {text && <p className="max-w-md text-sm text-[#5F6F67]">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "amber", children, role }: { tone?: "amber" | "red" | "green" | "grey"; children: React.ReactNode; role?: "alert" | "status" }) {
  const c =
    tone === "red"
      ? "border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D]"
      : tone === "green"
        ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]"
        : tone === "grey"
          ? "border-[#E3E8E5] bg-[#FAFBFA] text-[#33443C]"
          : "border-[#FDE68A] bg-[#FFFBEB] text-[#78350F]";
  return (
    <div role={role} className={`rounded-xl border p-3.5 text-sm leading-relaxed ${c}`}>
      {children}
    </div>
  );
}

/* ---------- Icons (inline SVG, 24 × 24, stroke) ---------- */

export type IconName =
  | "dashboard" | "bookings" | "live" | "drivers" | "flag" | "payouts" | "pricing" | "users"
  | "customers" | "search" | "plus" | "download" | "menu" | "close" | "inbox" | "chevron" | "alert" | "clock";

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  bookings: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M7.5 17h6" /></>,
  live: <><circle cx="12" cy="10" r="3" /><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /></>,
  drivers: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /><path d="M12 14.5V21M9.6 11.2 3.4 9.8M14.4 11.2l6.2-1.4" /></>,
  flag: <><path d="M5 21V4M5 4h11l-1.8 4L16 12H5" /></>,
  payouts: <><rect x="2.5" y="6" width="19" height="13" rx="2" /><path d="M2.5 10h19M6.5 15h3" /></>,
  pricing: <><path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9-9-9Z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  customers: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  inbox: <><path d="M3 13.5 5.5 5h13l2.5 8.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

export function Icon({ name, className = "h-[18px] w-[18px]" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[name]}
    </svg>
  );
}
