import Image from "next/image";
import { photoEntry, type PhotoId, type PlaceholderArt } from "@/lib/photos";
import type { PublicLang } from "@/lib/publicLang";

/**
 * One picture from the registry (src/lib/photos.ts), filling its frame.
 * The caller sets the frame's size and shape with `className` (e.g. "aspect-[3/2]
 * rounded-2xl"). A real photo is served by next/image (AVIF / WebP, sized for the
 * screen); an entry without a file shows its drawn placeholder instead, so a real
 * photo can be dropped in later by adding one line to the registry.
 * No hooks: works in server and client components.
 */
export function Photo({
  id,
  lang,
  sizes,
  priority = false,
  className = "",
  decorative = false,
  fill = false,
}: {
  id: PhotoId;
  lang: PublicLang;
  /** How wide the picture is shown, e.g. "(min-width: 1024px) 33vw, 100vw". */
  sizes: string;
  /** Only for the picture at the very top of a page (loads first). */
  priority?: boolean;
  className?: string;
  /** true when the text next to it already says the same (hidden from screen readers). */
  decorative?: boolean;
  /** true = cover the nearest positioned parent (a background behind text) instead of being its own block. */
  fill?: boolean;
}) {
  const p = photoEntry(id);
  const alt = decorative ? "" : p.alt[lang];
  const box = fill ? "absolute inset-0 overflow-hidden" : "relative overflow-hidden";
  if (!p.file || !p.width || !p.height) {
    return (
      <div
        className={`${box} bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100 ${className}`}
        {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": alt })}
      >
        <PlaceholderDrawing art={p.art} />
      </div>
    );
  }
  return (
    <div className={`${box} bg-emerald-900/10 ${className}`}>
      <Image
        src={`/photos/${p.file}`}
        alt={alt}
        width={p.width}
        height={p.height}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: p.focal }}
      />
    </div>
  );
}

const LINE = { fill: "none", stroke: "#047857", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const SOFT = { ...LINE, stroke: "#5eead4" } as const;

/** Simple line drawings on the soft emerald / teal gradient. 240 × 160, centred and scaled to the frame. */
function PlaceholderDrawing({ art }: { art: PlaceholderArt }) {
  return (
    <svg viewBox="0 0 240 160" preserveAspectRatio="xMaxYMid meet" className="absolute inset-0 h-full w-full" aria-hidden>
      <circle cx="190" cy="38" r="15" fill="#fde68a" opacity="0.9" />
      {DRAWINGS[art]}
    </svg>
  );
}

const WAVES = (
  <>
    <path d="M10 132q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0 24 0 24 0" {...SOFT} />
    <path d="M22 146q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0 24 0" {...SOFT} opacity="0.7" />
  </>
);

const GROUND = <path d="M14 128h212" {...SOFT} />;

const DRAWINGS: Record<PlaceholderArt, React.ReactNode> = {
  volcano: (
    <>
      <path d="M30 128 96 52q6-7 13-1l9 8q5 4 10 0l5-4q6-5 12 2l65 71" {...LINE} />
      <path d="M108 44c-8-8 2-14-4-22M124 46c8-9-3-13 4-24" {...SOFT} />
      <path d="M14 128h212" {...SOFT} />
      <path d="M40 128c8-14 22-14 30 0M168 128c8-12 20-12 28 0" {...LINE} opacity="0.55" />
    </>
  ),
  cloudforest: (
    <>
      <path d="M36 128V84M36 84c-14 0-20-12-12-22 0-14 18-18 24-6 12-2 18 12 8 22-4 6-12 6-20 6z" {...LINE} />
      <path d="M204 128V78M204 78c-14 0-20-12-12-22 0-14 18-18 24-6 12-2 18 12 8 22-4 6-12 6-20 6z" {...LINE} />
      <path d="M36 100q84 30 168 0M36 112q84 30 168 0" {...LINE} />
      <path d="M64 106v10M92 113v10M120 115v10M148 113v10M176 106v10" {...LINE} opacity="0.6" />
      <path d="M78 46h44a10 10 0 0 0 0-20 16 16 0 0 0-30-4 12 12 0 0 0-14 24z" {...SOFT} />
      {GROUND}
    </>
  ),
  riverboat: (
    <>
      <path d="M62 112h112l-14 18H78z" {...LINE} />
      <path d="M84 112V92h60l12 20M96 92V78h36v14" {...LINE} />
      <path d="M40 104c-2-22 6-40 20-52M60 52c-10-2-18 2-24 10M60 52c2-10 10-16 20-16M60 52c10 0 18 6 20 16" {...LINE} opacity="0.6" />
      {WAVES}
    </>
  ),
  rainforest: (
    <>
      <path d="M70 128V70M70 70c-22 2-34-16-24-30 4-18 30-20 36-6 18-4 26 16 14 28-6 8-16 8-26 8z" {...LINE} />
      <path d="M150 128V58M150 58c-26 2-40-18-28-34 4-20 34-22 42-6 20-4 30 18 16 32-8 8-18 8-30 8z" {...LINE} />
      <path d="M100 128c2-18 10-26 22-28M100 128c-2-14-8-22-18-24M196 128c0-16 6-24 16-28M196 128c-2-12-8-18-16-20" {...SOFT} />
      {GROUND}
    </>
  ),
  coast: (
    <>
      <path d="M150 122c-2-30 6-52 22-66M172 56c-12-4-22 0-30 10M172 56c0-12 8-20 20-22M172 56c12-2 22 4 26 16M172 56c8 6 12 16 10 28" {...LINE} />
      <path d="M118 124q40-10 108-4" {...LINE} opacity="0.6" />
      {WAVES}
    </>
  ),
  sedan: (
    <>
      <path d="M34 112h-6q-6 0-6-6v-10q0-8 8-10l26-6 20-18q5-4 12-4h46q8 0 14 5l22 17 34 6q10 2 10 12v8q0 6-6 6h-8" {...LINE} />
      <path d="M92 112h60M82 80h78M118 60v20" {...LINE} />
      <circle cx="68" cy="112" r="14" {...LINE} />
      <circle cx="176" cy="112" r="14" {...LINE} />
      {GROUND}
    </>
  ),
  suv: (
    <>
      <path d="M32 112h-6q-6 0-6-6V88q0-8 8-9l20-3 16-24q4-6 12-6h78q8 0 12 6l14 22 24 5q10 2 10 12v15q0 6-6 6h-8" {...LINE} />
      <path d="M92 112h60M68 78h112M112 48v30M150 48v30M84 40h78" {...LINE} />
      <circle cx="68" cy="112" r="15" {...LINE} />
      <circle cx="176" cy="112" r="15" {...LINE} />
      {GROUND}
    </>
  ),
  van: (
    <>
      <path d="M30 112h-6q-6 0-6-6V58q0-12 12-12h132q10 0 16 8l26 34q6 6 6 14v4q0 6-6 6h-6" {...LINE} />
      <path d="M90 112h64M18 82h186M64 46v36M106 46v36M148 46v36" {...LINE} />
      <circle cx="66" cy="112" r="15" {...LINE} />
      <circle cx="178" cy="112" r="15" {...LINE} />
      {GROUND}
    </>
  ),
};
