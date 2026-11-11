import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { AirportGuidePage, airportMeta } from "@/components/site/pages/GuidePages";
import { AIRPORT_GUIDES, airportGuide, airportPath } from "@/lib/guides";
import { bilingualMetadata } from "@/lib/pageMeta";

// Spanish airport guides: the same codes as /airports/[code], text from src/lib/guides/airports.ts.
export function generateStaticParams() {
  return AIRPORT_GUIDES.map((g) => ({ code: g.code }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ code: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const guide = airportGuide((await params).code);
  return guide ? bilingualMetadata(parent, { enPath: airportPath(guide), lang: "es", ...airportMeta(guide, "es") }) : {};
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const guide = airportGuide((await params).code);
  if (!guide) notFound();
  return <AirportGuidePage guide={guide} lang="es" />;
}
