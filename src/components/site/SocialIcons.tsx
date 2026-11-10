import { SOCIAL_LINKS, type SocialNetwork } from "@/lib/social";

/** Brand glyphs drawn inline (24×24), so no icon set or external image is needed. */
function Glyph({ network }: { network: SocialNetwork }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (network) {
    case "facebook":
      return (
        <svg {...common} fill="currentColor">
          <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common} fill="currentColor">
          <rect x="1.5" y="4.5" width="21" height="15" rx="4.5" />
          <path d="M10 8.75v6.5L15.5 12z" fill="#022c22" />
        </svg>
      );
    case "x":
      return (
        <svg {...common} fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
  }
}

/** Icons for the configured social profiles (src/lib/social.ts); renders nothing when none are set. */
export function SocialIcons({ label }: { label: string }) {
  if (!SOCIAL_LINKS.length) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {SOCIAL_LINKS.map((s) => (
        <li key={s.network}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer me"
            aria-label={s.label}
            className="w-11 h-11 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-emerald-50 flex items-center justify-center transition"
          >
            <Glyph network={s.network} />
          </a>
        </li>
      ))}
    </ul>
  );
}
