import { connection } from "next/server";
import { Storefront } from "@/components/Storefront";
import { getCatalog } from "@/lib/catalogSource";
import { todayInCostaRica } from "@/lib/dates";

// Rendered on every request: default travel dates and season pricing depend
// on today's date in Costa Rica, and the full page must be in the HTML for
// search engines and for visitors before JavaScript loads.
export default async function HomePage() {
  await connection();
  const today = todayInCostaRica();
  const catalog = await getCatalog();
  return <Storefront today={today} catalog={catalog} />;
}
