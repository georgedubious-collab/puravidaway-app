import type { Metadata, ResolvingMetadata } from "next";
import { CONTACT_PATH, ContactPage, contactMeta } from "@/components/site/pages/ContactPage";
import { bilingualMetadata } from "@/lib/pageMeta";

export async function generateMetadata(_props: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: CONTACT_PATH, lang: "es", ...contactMeta("es") });
}

export default async function Page() {
  return <ContactPage lang="es" />;
}
