import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { DestinationGuidePage, destinationMeta } from "@/components/site/pages/GuidePages";
import { DESTINATION_GUIDES, destinationGuide, destinationPath } from "@/lib/guides";
import { bilingualMetadata } from "@/lib/pageMeta";

// English destination guides. The Spanish ones are /es/destinos/[slug] (same slugs, same component).
export function generateStaticParams() {
  return DESTINATION_GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const guide = destinationGuide((await params).slug);
  return guide ? bilingualMetadata(parent, { enPath: destinationPath(guide), lang: "en", ...destinationMeta(guide, "en") }) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const guide = destinationGuide((await params).slug);
  if (!guide) notFound();
  return <DestinationGuidePage guide={guide} lang="en" />;
}
