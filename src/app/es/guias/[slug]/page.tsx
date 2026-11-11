import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage, articleMeta } from "@/components/site/pages/BlogPages";
import { ARTICLES, article, articlePath } from "@/lib/blog";
import { bilingualMetadata } from "@/lib/pageMeta";

// Spanish travel guides: the same slugs as /guides/[slug], text from src/lib/blog.
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const a = article((await params).slug);
  return a ? bilingualMetadata(parent, { enPath: articlePath(a), lang: "es", ...articleMeta(a, "es") }) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const a = article((await params).slug);
  if (!a) notFound();
  return <ArticlePage article={a} lang="es" />;
}
