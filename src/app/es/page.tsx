import type { Metadata, ResolvingMetadata } from "next";
import { HOME_META_ES, HomePage } from "@/components/site/pages/HomePage";
import { bilingualMetadata } from "@/lib/pageMeta";

// The booking storefront in Spanish. Same component, prices and trip request as "/".
export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: "/", lang: "es", ...HOME_META_ES });
}

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <HomePage lang="es" searchParams={searchParams} />;
}
