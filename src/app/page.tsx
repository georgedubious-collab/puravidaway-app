import type { Metadata } from "next";
import { HomePage } from "@/components/site/pages/HomePage";
import { bilingualAlternates } from "@/lib/publicLang";

// Title, description and link previews come from the root layout; this adds the
// canonical link and the hreflang pair with the Spanish home page (/es).
export const metadata: Metadata = { alternates: bilingualAlternates("/", "en") };

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <HomePage lang="en" searchParams={searchParams} />;
}
