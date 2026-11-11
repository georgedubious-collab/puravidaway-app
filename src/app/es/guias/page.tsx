import type { Metadata, ResolvingMetadata } from "next";
import { BlogIndexPage, blogIndexMeta } from "@/components/site/pages/BlogPages";
import { BLOG_PATH } from "@/lib/blog";
import { bilingualMetadata } from "@/lib/pageMeta";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: BLOG_PATH, lang: "es", ...blogIndexMeta("es") });
}

export default function Page() {
  return <BlogIndexPage lang="es" />;
}
