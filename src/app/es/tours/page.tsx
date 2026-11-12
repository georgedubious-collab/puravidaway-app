import type { Metadata, ResolvingMetadata } from "next";
import { ToursIndexPage, toursIndexMeta } from "@/components/site/pages/TourPages";
import { bilingualMetadata } from "@/lib/pageMeta";
import { TOURS_PATH } from "@/lib/tours";

// Índice de los tours de un día, por región (español; inglés: /tours).
export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: TOURS_PATH, lang: "es", ...toursIndexMeta("es") });
}

export default function Page() {
  return <ToursIndexPage lang="es" />;
}
