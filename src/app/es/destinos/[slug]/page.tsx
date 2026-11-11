import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { DestinationGuidePage, destinationMeta } from "@/components/site/pages/GuidePages";
import { DESTINATION_GUIDES, destinationGuide, destinationPath } from "@/lib/guides";
import { bilingualMetadata } from "@/lib/pageMeta";

// Spanish destination guides: the same slugs as /destinations/[slug], text from src/lib/guides/destinations.ts.
export function generateStaticParams() {
  return DESTINATION_GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const guide = destinationGuide((await params).slug);
  return guide ? bilingualMetadata(parent, { enPath: destinationPath(guide), lang: "es", ...destinationMeta(guide, "es") }) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const guide = destinationGuide((await params).slug);
  if (!guide) notFound();
  return <DestinationGuidePage guide={guide} lang="es" />;
}
