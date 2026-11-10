import type { PhotoId } from "@/lib/photos";
import type { PublicLang } from "@/lib/publicLang";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { Photo } from "./Photo";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * Shell for the public info pages (about, how it works, FAQ, contact… and later
 * destination guides and blog posts): header, breadcrumbs, a hero with the H1
 * and a short direct answer, the page body and the footer.
 */
export function PublicPage({
  lang,
  current,
  path,
  crumbs,
  eyebrow,
  title,
  lead,
  photo,
  children,
}: {
  lang: PublicLang;
  current?: string;
  /** This page's path, for the breadcrumb structured data. */
  path: string;
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  /** The short, direct answer shown under the H1 (what answer engines quote). */
  lead: React.ReactNode;
  /** One picture for the page (src/lib/photos.ts): beside the text on desktop, under it on phones. */
  photo?: PhotoId;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <SiteHeader lang={lang} current={current} />
      <main className="flex-1">
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-10 sm:pb-14">
            <Breadcrumbs lang={lang} items={crumbs} currentPath={path} />
            <div className={photo ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-10 lg:items-center" : ""}>
              <div>
                {eyebrow && <p className="mt-6 text-xs font-bold uppercase tracking-widest text-emerald-700">{eyebrow}</p>}
                <h1
                  className={`${eyebrow ? "mt-2" : "mt-6"} text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.08] max-w-3xl`}
                >
                  {title}
                </h1>
                <div className="mt-4 text-lg leading-relaxed text-slate-600 max-w-3xl">{lead}</div>
              </div>
              {photo && (
                <Photo
                  id={photo}
                  lang={lang}
                  priority
                  sizes="(min-width: 1024px) 440px, 100vw"
                  className="mt-6 lg:mt-6 aspect-[16/9] lg:aspect-[3/2] rounded-2xl"
                />
              )}
            </div>
          </div>
        </section>
        {children}
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}

/** A content section with an H2, used inside PublicPage. */
export function PageSection({
  id,
  title,
  intro,
  children,
  tone = "plain",
}: {
  id: string;
  title: string;
  intro?: React.ReactNode;
  children?: React.ReactNode;
  tone?: "plain" | "white";
}) {
  return (
    <section aria-labelledby={`${id}-h`} className={tone === "white" ? "bg-white border-y border-slate-200" : ""}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 id={`${id}-h`} className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {title}
        </h2>
        {intro && <div className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">{intro}</div>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
