import type { Metadata, ResolvingMetadata } from "next";
import { getCatalog } from "@/lib/catalogSource";
import { HOW_PATH, HowItWorksPage, howMeta } from "@/components/site/pages/HowItWorksPage";
import { bilingualMetadata } from "@/lib/pageMeta";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: HOW_PATH, lang: "en", ...howMeta("en") });
}

export default async function Page() {
  const catalog = await getCatalog();
  return <HowItWorksPage lang="en" cashFeeBps={catalog.cashFeeBps} />;
}
