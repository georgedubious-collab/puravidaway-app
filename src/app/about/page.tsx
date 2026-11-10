import type { Metadata, ResolvingMetadata } from "next";
import { ABOUT_PATH, AboutPage, aboutMeta } from "@/components/site/pages/AboutPage";
import { bilingualMetadata } from "@/lib/pageMeta";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: ABOUT_PATH, lang: "en", ...aboutMeta("en") });
}

export default async function Page() {
  return <AboutPage lang="en" />;
}
