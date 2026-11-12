import type { Metadata, ResolvingMetadata } from "next";
import { ToursIndexPage, toursIndexMeta } from "@/components/site/pages/TourPages";
import { bilingualMetadata } from "@/lib/pageMeta";
import { TOURS_PATH } from "@/lib/tours";

// Index of all day tours, grouped by region (English; Spanish: /es/tours).
export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: TOURS_PATH, lang: "en", ...toursIndexMeta("en") });
}

export default function Page() {
  return <ToursIndexPage lang="en" />;
}
