import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { TourDetailPage, tourMeta } from "@/components/site/pages/TourPages";
import { getCatalog } from "@/lib/catalogSource";
import { bilingualMetadata } from "@/lib/pageMeta";
import { TOUR_PAGES, catalogTour, tourPage, tourPath } from "@/lib/tours";

// Spanish day tour pages: the same slugs as /tours/[slug], same data (src/lib/tours).
export function generateStaticParams() {
  return TOUR_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const page = tourPage((await params).slug);
  return page ? bilingualMetadata(parent, { enPath: tourPath(page), lang: "es", ...tourMeta(page, await getCatalog(), "es") }) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const page = tourPage((await params).slug);
  // A tour switched off in /admin/pricing has no page.
  if (!page || !catalogTour(page, await getCatalog())) notFound();
  return <TourDetailPage page={page} lang="es" />;
}
