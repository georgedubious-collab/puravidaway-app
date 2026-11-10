/**
 * The Costa Rica Private Transfers logo ("CR route", emerald + gold): the letters
 * C and R drawn as one road, with a gold dot at the start and at the end of the ride.
 *
 * One component for every place the brand shows: site header and footer, the
 * trip page, login, admin and driver headers, error screens. No hooks, so it
 * works in server and client components. The same drawing is in
 * src/app/icon.svg (browser tab), src/app/apple-icon.png, public/brand/*.png
 * (emails, social profiles) and src/app/opengraph-image.tsx: change them together.
 */

/** Brand colours of the mark. */
export const LOGO_COLORS = {
  emerald: "#047857",
  gold: "#F5B301",
  goldOnDark: "#FBBF24",
  white: "#FFFFFF",
} as const;

/** The two strokes and two dots, in a 64 × 64 box. `stroke` = letters, `dot` = the gold dots. */
export function logoMarkPaths(stroke: string, dot: string) {
  return (
    <>
      <path d="M30 21.8A13 13 0 1 0 30 42.2" fill="none" stroke={stroke} strokeWidth="6.5" strokeLinecap="round" />
      <path
        d="M40 45V19h7a7.5 7.5 0 0 1 0 15h-7m7 0 8 11"
        fill="none"
        stroke={stroke}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="21.8" r="4.6" fill={dot} />
      <circle cx="55" cy="45" r="4.6" fill={dot} />
    </>
  );
}

type Tone = "light" | "dark";

/**
 * The mark alone.
 * - `on="light"`: emerald letters, gold dots (white or pale backgrounds).
 * - `on="dark"`: white letters, lighter gold dots (dark green backgrounds).
 * - `badge`: white letters on an emerald rounded square (the app-icon look).
 */
export function LogoMark({
  on = "light",
  badge = false,
  className = "h-9 w-auto",
  title,
}: {
  on?: Tone;
  badge?: boolean;
  className?: string;
  /** Accessible name; leave empty when the wordmark or a label sits next to it. */
  title?: string;
}) {
  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);
  if (badge) {
    return (
      <svg viewBox="0 0 64 64" className={className} {...a11y}>
        <rect width="64" height="64" rx="14" fill={LOGO_COLORS.emerald} />
        <g transform="translate(6.4 6.4) scale(0.8)">{logoMarkPaths(LOGO_COLORS.white, LOGO_COLORS.goldOnDark)}</g>
      </svg>
    );
  }
  const stroke = on === "dark" ? LOGO_COLORS.white : LOGO_COLORS.emerald;
  const dot = on === "dark" ? LOGO_COLORS.goldOnDark : LOGO_COLORS.gold;
  // Cropped to the drawing (the full box has empty bands above and below), so it lines up with the wordmark.
  return (
    <svg viewBox="4 13 57.5 39" className={className} {...a11y}>
      {logoMarkPaths(stroke, dot)}
    </svg>
  );
}

const SIZES = {
  sm: { mark: "h-7 w-auto", top: "text-[9px] tracking-[0.2em]", main: "text-sm", gap: "gap-2" },
  md: { mark: "h-7 min-[420px]:h-8 sm:h-9 w-auto", top: "text-[9px] min-[420px]:text-[10px] tracking-[0.22em]", main: "text-[13px] min-[420px]:text-[15px] sm:text-lg", gap: "gap-2 min-[420px]:gap-2.5" },
  lg: { mark: "h-11 w-auto", top: "text-xs tracking-[0.24em]", main: "text-2xl", gap: "gap-3" },
} as const;

/**
 * Mark + wordmark ("COSTA RICA" over "Private Transfers"), or the mark alone
 * with `wordmark={false}`. The full name is always the accessible name.
 */
export function Logo({
  on = "light",
  wordmark = true,
  size = "md",
  className = "",
}: {
  on?: Tone;
  wordmark?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  if (!wordmark) return <LogoMark on={on} className={`${s.mark} ${className}`} title="Costa Rica Private Transfers" />;
  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <LogoMark on={on} className={`${s.mark} shrink-0`} />
      <span className="flex flex-col leading-none">
        <span className={`${s.top} font-bold uppercase ${on === "dark" ? "text-amber-300" : "text-emerald-700"}`}>Costa Rica</span>
        <span
          className={`${s.main} mt-1 font-extrabold tracking-tight whitespace-nowrap ${on === "dark" ? "text-white" : "text-slate-900"}`}
        >
          Private Transfers
        </span>
      </span>
    </span>
  );
}
