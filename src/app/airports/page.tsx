import type { Metadata, ResolvingMetadata } from "next";
import { AirportsIndexPage, airportsIndexMeta } from "@/components/site/pages/GuidePages";
import { AIRPORTS_PATH } from "@/lib/guides";
import { bilingualMetadata } from "@/lib/pageMeta";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: AIRPORTS_PATH, lang: "en", ...airportsIndexMeta("en") });
}

export default function Page() {
  return <AirportsIndexPage lang="en" />;
}
