import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Storefront } from "@/components/Storefront";
import { getCatalog } from "@/lib/catalogSource";
import { todayInCostaRica } from "@/lib/dates";

// Rendered on every request: default travel dates and season pricing depend
// on today's date in Costa Rica, and the full page must be in the HTML for
// search engines and for visitors before JavaScript loads.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  // A sign-in link that fell back to the Site URL lands here with ?code=…
  const { code, next } = await searchParams;
  if (typeof code === "string" && code) {
    const keep = typeof next === "string" ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/auth/callback?code=${encodeURIComponent(code)}${keep}`);
  }
  const today = todayInCostaRica();
  const catalog = await getCatalog();
  return <Storefront today={today} catalog={catalog} />;
}
