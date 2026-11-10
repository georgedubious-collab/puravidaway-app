import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { whatsAppLink } from "@/lib/cart";
import { bilingualAlternates } from "@/lib/publicLang";

export const metadata: Metadata = {
  title: "Política de cancelación y reembolsos | Costa Rica Private Transfers",
  description:
    "Cancelación gratis hasta 24 horas antes de la recogida en traslados y tours de un día en Costa Rica; reglas de reembolso claras para expediciones de varios días.",
  alternates: bilingualAlternates("/cancellation", "es"),
};

/*
 * Spanish translation of src/app/cancellation/page.tsx. The English page is the original.
 * Rules decided by the owner on 2026-11-08 (docs/PROJECT.md §9 #7).
 * Change them only together with that section and the English page.
 */
export default function CancelacionPage() {
  return (
    <LegalPage
      lang="es"
      title="Política de cancelación y reembolsos"
      intro={
        <>
          <p>
            Los planes cambian. Aquí está exactamente lo que usted recupera si cancela o cambia su viaje. “Los
            montos que usted nos ha pagado” significa lo que usted pagó a Costa Rica Private Transfers por el
            servicio que cancela. Las horas son hora de Costa Rica y se cuentan desde la hora confirmada de
            recogida o de inicio.
          </p>
          <p className="mt-3">
            Esta es una traducción de la versión en inglés. Si hubiera alguna diferencia entre ambas, prevalece la{" "}
            <Link href="/cancellation" hrefLang="en">
              versión en inglés
            </Link>
            .
          </p>
        </>
      }
    >
      <LegalSection id="rides-tours" title="1. Traslados y tours de un día">
        <div className="grid gap-3 sm:grid-cols-2">
          <Rule
            tone="good"
            when="24 horas o más antes de la recogida"
            what="Cancelación gratis, reembolso completo."
          />
          <Rule
            tone="bad"
            when="Menos de 24 horas antes de la recogida, o si no se presenta"
            what="Sin reembolso."
          />
        </div>
        <p className="mt-4">
          Las paradas turísticas y el Smart En-Route Transfer siguen las reglas del traslado o del tour
          al que pertenecen.
        </p>
      </LegalSection>

      <LegalSection id="expeditions" title="2. Expediciones de varios días">
        <div className="grid gap-3 sm:grid-cols-3">
          <Rule
            tone="good"
            when="30 días o más antes del inicio"
            what="Reembolso completo, menos los costos no reembolsables ya pagados (vea abajo)."
          />
          <Rule tone="mid" when="De 8 a 29 días antes del inicio" what="Reembolso del 50%." />
          <Rule
            tone="bad"
            when="7 días o menos antes del inicio, o si no se presenta"
            what="Sin reembolso."
          />
        </div>
        <p className="mt-4">
          <strong>Costos no reembolsables:</strong> los permisos de parques del SINAC (por ejemplo,
          Corcovado y la Estación Sirena) y los depósitos de botes o de alojamiento se pagan a esos
          operadores por adelantado y no se pueden recuperar una vez pagados. Si usted cancela con 30
          días o más de anticipación, descontamos solo los montos que ya hayamos pagado, y le mostramos
          los recibos si los solicita.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="3. Cambiar la fecha o la hora">
        <ul>
          <li>
            Los cambios de fecha o de hora son <strong>gratis si los pide 24 horas o más</strong> antes
            de la recogida (o antes del inicio de una expedición), sujetos a la disponibilidad de
            conductores, permisos y alojamiento.
          </li>
          <li>
            Si la nueva fecha tiene un precio de temporada distinto, o si un cambio nos genera un costo
            adicional con un parque o un operador, le informamos la diferencia antes de que usted acepte
            el cambio.
          </li>
          <li>
            Los cambios pedidos con menos de 24 horas de anticipación se tratan como una cancelación y
            una nueva reserva.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cash" title="4. Reservas con pago en efectivo al conductor">
        <p>
          Si usted eligió pagar al conductor en efectivo, se aplican los mismos plazos. El cargo por
          reserva en efectivo se reembolsa si usted cancela 24 horas o más antes de la recogida, y{" "}
          <strong>no es reembolsable</strong> si cancela con menos de 24 horas de anticipación o no se
          presenta.
        </p>
      </LegalSection>

      <LegalSection id="we-cancel" title="5. Si nosotros o el conductor cancelamos">
        <p>
          Si nosotros o su conductor cancelamos un servicio confirmado por cualquier motivo distinto de
          los de la sección 6, usted recibe un <strong>reembolso completo</strong> de los montos que nos
          ha pagado por ese servicio. Siempre intentaremos primero conseguirle otro conductor u otro
          vehículo de la misma categoría o de una superior, sin costo adicional.
        </p>
      </LegalSection>

      <LegalSection id="weather" title="6. Clima y cierres de carreteras y parques">
        <p>
          Si lluvias fuertes, inundaciones, deslizamientos, cierres de carreteras, actividad volcánica,
          el cierre de un parque o la orden de una autoridad impiden que un servicio se realice de forma
          segura, le ofrecemos elegir entre <strong>reprogramarlo</strong> para otra fecha o el{" "}
          <strong>reembolso del servicio afectado</strong>. Si solo se ve afectada una parte de un viaje
          (por ejemplo, una parada o un día de una expedición), la reprogramación o el reembolso se
          aplica a esa parte. Los permisos de parques que el propio SINAC reembolse o cambie de fecha se
          le trasladan a usted.
        </p>
      </LegalSection>

      <LegalSection id="how" title="7. Cómo cancelar y cómo se pagan los reembolsos">
        <ul>
          <li>
            Cancele o cambie en el chat de su viaje, o escriba a nuestro equipo por{" "}
            <a
              href={whatsAppLink("¡Hola! Quisiera cancelar o cambiar mi reserva.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>{" "}
            con su referencia de reserva. Cuenta la hora en que recibimos su mensaje.
          </li>
          <li>
            Confirmamos por escrito la cancelación y el monto del reembolso, y enviamos el reembolso al
            mismo medio con el que usted pagó lo antes posible. Su banco o el emisor de su tarjeta puede
            tardar unos días más en reflejarlo.
          </li>
          <li>Las partes no utilizadas de un viaje que usted deja antes de tiempo no se reembolsan.</li>
        </ul>
        <p>
          Esta política forma parte de nuestros <Link href="/es/terminos">Términos del servicio</Link> y
          no limita ningún derecho que usted tenga según la ley costarricense de protección al
          consumidor.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

const TONE = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-950",
  mid: "border-amber-200 bg-amber-50 text-amber-950",
  bad: "border-slate-200 bg-white text-slate-900",
} as const;

function Rule({ tone, when, what }: { tone: keyof typeof TONE; when: string; what: string }) {
  return (
    <div className={`rounded-xl border p-4 ${TONE[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wider opacity-80">{when}</p>
      <p className="mt-1 text-base font-extrabold">{what}</p>
    </div>
  );
}
