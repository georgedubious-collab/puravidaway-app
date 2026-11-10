import type { Metadata, ResolvingMetadata } from "next";
import { DRIVERS_PATH, OurDriversPage, driversMeta } from "@/components/site/pages/OurDriversPage";
import { bilingualMetadata } from "@/lib/pageMeta";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: DRIVERS_PATH, lang: "es", ...driversMeta("es") });
}

export default async function Page() {
  return <OurDriversPage lang="es" />;
}
