import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage, articleMeta } from "@/components/site/pages/BlogPages";
import { ARTICLES, article, articlePath } from "@/lib/blog";
import { bilingualMetadata } from "@/lib/pageMeta";

// English travel guides (the blog). The Spanish ones are /es/guias/[slug] (same slugs, same component).
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const a = article((await params).slug);
  return a ? bilingualMetadata(parent, { enPath: articlePath(a), lang: "en", ...articleMeta(a, "en") }) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const a = article((await params).slug);
  if (!a) notFound();
  return <ArticlePage article={a} lang="en" />;
}
