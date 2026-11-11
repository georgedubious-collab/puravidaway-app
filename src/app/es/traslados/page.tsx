import type { Metadata, ResolvingMetadata } from "next";
import { TransfersIndexPage, transfersIndexMeta } from "@/components/site/pages/RouteLandingPage";
import { bilingualMetadata } from "@/lib/pageMeta";
import { TRANSFERS_PATH } from "@/lib/routePages";

// Index of all route pages, grouped by pickup town (Spanish; English: /transfers).
export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: TRANSFERS_PATH, lang: "es", ...transfersIndexMeta("es") });
}

export default function Page() {
  return <TransfersIndexPage lang="es" />;
}
