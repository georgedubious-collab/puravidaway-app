import type { Metadata, ResolvingMetadata } from "next";
import { getCatalog } from "@/lib/catalogSource";
import { FAQ_PATH, FaqPage, faqMeta } from "@/components/site/pages/FaqPage";
import { bilingualMetadata } from "@/lib/pageMeta";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: FAQ_PATH, lang: "en", ...faqMeta("en") });
}

export default async function Page() {
  const catalog = await getCatalog();
  return <FaqPage lang="en" values={{ cashFeeBps: catalog.cashFeeBps, nightPremium: catalog.nightPremium }} />;
}
