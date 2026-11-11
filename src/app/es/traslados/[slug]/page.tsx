import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { RouteLandingPage, routePageMetadata } from "@/components/site/pages/RouteLandingPage";
import { ROUTE_PAGES, routePage } from "@/lib/routePages";

// Spanish route pages: the same slugs as /transfers/[slug], same data (src/lib/routePages.ts).
export function generateStaticParams() {
  return ROUTE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const page = routePage((await params).slug);
  return page ? routePageMetadata(page, "es", parent) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const page = routePage((await params).slug);
  if (!page) notFound();
  return <RouteLandingPage page={page} lang="es" />;
}
