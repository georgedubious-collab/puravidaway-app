import { PageHeader } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { HUBS } from "@/lib/catalog";
import { localizeCatalog, placeNameFor } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { todayInCostaRica } from "@/lib/dates";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { ManualBookingForm } from "./ManualBookingForm";

/** "Nueva reserva": a booking that came by WhatsApp or phone, priced and saved like a website request. */
export default async function NewBookingPage() {
  await requireRole("admin", "/admin/bookings/new");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const catalog = localizeCatalog(await getCatalog(), lang);
  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/admin/bookings", label: t("Todas las reservas", "All bookings") }}
        title={t("Nueva reserva", "New booking")}
        subtitle={t(
          "Para una reserva que llegó por WhatsApp o teléfono. Se calcula con los mismos precios del sitio web (temporada, recargo nocturno, paradas) y se guarda igual que una solicitud del sitio: queda «Esperando pago» y sigue el mismo camino.",
          "For a booking that came by WhatsApp or phone. It's priced with the website's own prices (season, night premium, stops) and saved just like a website request: it starts as \"Awaiting payment\" and follows the same path.",
        )}
      />
      <ManualBookingForm
        lang={lang}
        today={todayInCostaRica()}
        hubs={HUBS.map((h) => ({ id: h.id, name: placeNameFor(h.name, lang) }))}
        vehicles={catalog.vehicles.map((v) => ({ id: v.id, name: v.name, maxPax: v.maxPax, allowsStops: v.allowsStops }))}
        stops={catalog.stops.map((s) => ({ id: s.id, name: s.name, corridors: [...s.corridors] }))}
        tours={catalog.dayTours.map((d) => ({ id: d.id, name: d.name }))}
        cashFeeBps={catalog.cashFeeBps}
      />
    </div>
  );
}
