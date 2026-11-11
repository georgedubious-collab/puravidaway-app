import { redirect } from "next/navigation";
import { connection } from "next/server";
import { HomeSections } from "@/components/site/HomeSections";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Storefront } from "@/components/Storefront";
import { getCatalog } from "@/lib/catalogSource";
import { todayInCostaRica } from "@/lib/dates";
import type { PublicLang } from "@/lib/publicLang";

/** Spanish title and description of the home page (/es); English uses the site-wide ones in src/lib/site.ts. */
export const HOME_META_ES = {
  title: "Traslados privados, paradas turísticas y tours en Costa Rica",
  description:
    "Traslados privados puerta a puerta con paradas turísticas, ofertas de conductores y tours privados de un día por toda Costa Rica.",
};

/**
 * The home page = the booking storefront, at / (English) and /es (Spanish).
 * Rendered on every request: default travel dates and season pricing depend
 * on today's date in Costa Rica, and the full page must be in the HTML for
 * search engines and for visitors before JavaScript loads.
 */
export async function HomePage({
  lang,
  searchParams,
}: {
  lang: PublicLang;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  // A sign-in link that fell back to the Site URL lands here with ?code=…
  const { code, next } = await searchParams;
  if (typeof code === "string" && code) {
    const keep = typeof next === "string" ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/auth/callback?code=${encodeURIComponent(code)}${keep}`);
  }
  const today = todayInCostaRica();
  const catalog = await getCatalog();
  return (
    <Storefront
      lang={lang}
      today={today}
      catalog={catalog}
      below={<HomeSections lang={lang} catalog={catalog} />}
      footer={<SiteFooter lang={lang} />}
    />
  );
}
