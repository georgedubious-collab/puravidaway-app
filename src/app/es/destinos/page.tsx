import type { Metadata, ResolvingMetadata } from "next";
import { DestinationsIndexPage, destinationsIndexMeta } from "@/components/site/pages/GuidePages";
import { DESTINATIONS_PATH } from "@/lib/guides";
import { bilingualMetadata } from "@/lib/pageMeta";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: DESTINATIONS_PATH, lang: "es", ...destinationsIndexMeta("es") });
}

export default function Page() {
  return <DestinationsIndexPage lang="es" />;
}
