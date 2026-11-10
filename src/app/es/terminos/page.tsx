import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY_PLACEHOLDER_ES, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { whatsAppLink } from "@/lib/cart";
import { bilingualAlternates } from "@/lib/publicLang";
import { CARRIER_NOTE_ES } from "@/lib/trust";

export const metadata: Metadata = {
  title: "Términos del servicio | Costa Rica Private Transfers",
  description:
    "Los términos para reservar traslados privados, paradas turísticas, tours de un día y expediciones de varios días en Costa Rica con Costa Rica Private Transfers.",
  alternates: bilingualAlternates("/terms", "es"),
};

/*
 * Spanish translation of src/app/terms/page.tsx. The English page is the original:
 * change both together, section by section, and keep the same section ids.
 */
export default function TerminosPage() {
  return (
    <LegalPage
      lang="es"
      title="Términos del servicio"
      intro={
        <>
          <p>
            Estos términos se aplican cuando usted planifica, solicita o reserva un viaje con Costa Rica Private
            Transfers. Por favor léalos junto con nuestra{" "}
            <Link href="/es/cancelacion">Política de cancelación</Link> y nuestra{" "}
            <Link href="/es/privacidad">Política de privacidad</Link>. Al enviar una solicitud de viaje, usted los
            acepta.
          </p>
          <p className="mt-3">
            Esta es una traducción de la versión en inglés. Si hubiera alguna diferencia entre ambas, prevalece la{" "}
            <Link href="/terms" hrefLang="en">
              versión en inglés
            </Link>
            .
          </p>
        </>
      }
    >
      <LegalSection id="who" title="1. Quiénes somos">
        <p>
          Costa Rica Private Transfers es una plataforma de reservas en línea de traslados privados con paradas
          turísticas, tours privados de un día y expediciones de varios días en Costa Rica. La plataforma es operada
          por <strong>{LEGAL_ENTITY_PLACEHOLDER_ES}</strong> (“Costa Rica Private Transfers”, “nosotros”, “nuestro
          equipo”).
        </p>
        <p>
          {CARRIER_NOTE_ES} Seleccionamos y verificamos a nuestros conductores asociados (entrevista,
          verificación de antecedentes penales y del historial de manejo, información del vehículo y
          comprobante de seguro), organizamos su viaje con ellos y nos mantenemos en contacto con usted
          antes y durante el viaje. Cuando un conductor tiene un permiso de transporte turístico del
          Instituto Costarricense de Turismo (ICT), lo mostramos en el perfil de ese conductor; es una
          insignia de cada conductor, no una promesa sobre todos los traslados.
        </p>
        <p>
          Algunas partes de un viaje, como las entradas a parques, los botes, los alojamientos, los guías
          y las actividades, las brindan otros operadores independientes (vea la sección 7).
        </p>
      </LegalSection>

      <LegalSection id="requests" title="2. Solicitudes de viaje y confirmación">
        <ul>
          <li>
            Enviar una solicitud de viaje en nuestro sitio, por WhatsApp o por correo electrónico{" "}
            <strong>no es una reserva</strong>. Con ella le pide a nuestro equipo que revise la
            disponibilidad para sus fechas, su ruta y su grupo.
          </li>
          <li>
            Un servicio queda reservado solo cuando nuestro equipo{" "}
            <strong>se lo confirma por escrito</strong> (por correo electrónico o en el chat de su viaje)
            y, cuando el pago debe hacerse por adelantado, una vez recibido ese pago. Hasta entonces
            podemos rechazar una solicitud o proponer un cambio.
          </li>
          <li>
            Su confirmación muestra los servicios, las fechas, las horas de recogida, los lugares y el
            precio. Por favor revísela y avísenos de inmediato si algo está mal.
          </li>
          <li>
            Si usted propone su propio precio (ofertas de conductores), el viaje queda reservado solo
            cuando se acepta una oferta y nosotros lo confirmamos.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="prices" title="3. Precios y pago">
        <ul>
          <li>
            Todos los precios están en <strong>dólares estadounidenses (USD)</strong>. Los montos en otras
            monedas son solo una estimación.
          </li>
          <li>
            Los precios pueden variar según la temporada (por ejemplo, la temporada alta y las semanas de
            feriados). El precio de su confirmación por escrito es el precio que usted paga por los
            servicios que allí se indican; no agregamos después recargos por alta demanda ni por
            combustible.
          </li>
          <li>
            Un precio cubre solo lo que indica su confirmación. Las entradas a parques, las comidas, las
            propinas y las actividades opcionales se pagan aparte, salvo que la confirmación diga que
            están incluidas.
          </li>
          <li>
            Cómo y cuándo pagar se muestra antes de reservar y en su confirmación. Los pagos con tarjeta
            los procesa nuestro proveedor de pagos; nosotros nunca vemos ni guardamos los datos completos
            de su tarjeta.
          </li>
          <li>
            El tiempo de espera adicional, las paradas adicionales o los cambios de ruta que usted pida
            el mismo día pueden tener un costo adicional; el conductor o nuestro equipo le dirá el precio
            antes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="you" title="4. Sus responsabilidades">
        <ul>
          <li>
            Denos datos exactos: nombres, número de pasajeros (incluidos los niños y sus edades), número
            de vuelo y hora de llegada, hotel o direcciones exactas de recogida y de destino, y un número
            de celular donde podamos contactarlo durante el viaje.
          </li>
          <li>Avísenos sin demora de cualquier cambio, como una nueva hora de vuelo o un nuevo hotel.</li>
          <li>Esté listo en el lugar y a la hora de recogida acordados.</li>
          <li>
            Respete el límite de equipaje del vehículo que reservó. Avísenos con anticipación si lleva
            tablas de surf, bicicletas, maletas adicionales o de gran tamaño. Si el equipaje no cabe de
            forma segura, el conductor puede negarse a llevarlo o puede hacer falta un vehículo más
            grande con un costo adicional.
          </li>
          <li>
            Solicite las sillas para niños y los asientos elevadores (boosters) al reservar, indicando la
            edad de cada niño. La ley costarricense exige sistemas de retención infantil adecuados, por
            lo que es posible que un conductor no pueda llevar a un niño sin uno.
          </li>
          <li>
            Lleve un pasaporte o documento de identidad vigente, siga las instrucciones de seguridad del
            conductor y use el cinturón de seguridad. Los conductores pueden negarse a llevar a cualquier
            persona que esté agresiva, en estado de ebriedad o intoxicación grave, o que lleve objetos
            ilegales o peligrosos, sin reembolso.
          </li>
          <li>
            Pague cualquier daño o limpieza adicional que usted o su grupo causen en un vehículo.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="waiting" title="5. Recogidas y tiempo de espera">
        <ul>
          <li>
            <strong>Recogidas en el aeropuerto:</strong> hacemos seguimiento de su vuelo, de modo que el
            conductor se ajusta a los retrasos. El conductor espera hasta 60 minutos después de la hora
            real de aterrizaje sin costo adicional.
          </li>
          <li>
            <strong>Otras recogidas</strong> (hoteles, muelles, direcciones): el conductor espera hasta
            15 minutos después de la hora acordada sin costo adicional.
          </li>
          <li>
            Si no lo encontramos y no logramos contactarlo por teléfono, por WhatsApp o en el chat de su
            viaje dentro del tiempo de espera, el traslado se considera una no presentación (vea la{" "}
            <Link href="/es/cancelacion">Política de cancelación</Link>). Si sabe que va a llegar tarde,
            escríbanos: intentaremos ayudarle, y la espera adicional puede tener un costo adicional.
          </li>
          <li>
            Los tiempos de viaje que mostramos son estimaciones realistas para las carreteras de montaña
            de Costa Rica, no garantías. El tráfico, el clima, las obras en la vía y las paradas que
            usted elija pueden alargar un viaje.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="parks" title="6. Parques nacionales, permisos y entradas con horario">
        <ul>
          <li>
            El <strong>Parque Nacional Corcovado</strong> exige permisos del SINAC y guías certificados
            reservados con anticipación, y los espacios para pasar la noche en la Estación Sirena son
            limitados. Los solicitamos por usted una vez que su expedición está confirmada y pagada según
            lo requerido; la disponibilidad la decide el SINAC, no nosotros.
          </li>
          <li>
            El <strong>Volcán Poás</strong> usa entradas con horario asignado que se agotan. La hora de
            su visita depende de las entradas disponibles.
          </li>
          <li>
            Los parques y las autoridades pueden cerrar senderos o parques enteros con poco aviso (por
            ejemplo, por el clima, la actividad volcánica o la capacidad). Las reglas, las tarifas y los
            horarios de los parques los fija cada parque, no nosotros.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="operators" title="7. Operadores externos">
        <p>
          Los botes, los alojamientos, los guías, los parques, los tours y las actividades incluidos en
          un viaje los brindan operadores independientes bajo sus propios términos y reglas de seguridad.
          Elegimos a los operadores con cuidado y les transmitimos los datos de su reserva, pero no
          controlamos cómo prestan sus servicios. Por favor siga sus instrucciones, en especial en botes,
          actividades acuáticas, caminatas y canopy (tirolesas).
        </p>
      </LegalSection>

      <LegalSection id="liability" title="8. Nuestra responsabilidad y sus límites">
        <ul>
          <li>
            Somos responsables de organizar los servicios de su confirmación con un cuidado y una
            competencia razonables, y de la información que le damos sobre ellos.
          </li>
          <li>
            El conductor asociado o el operador que presta un servicio es responsable de prestarlo,
            incluidos su vehículo, sus licencias, sus permisos y su seguro.
          </li>
          <li>
            En la medida en que la ley lo permita, nuestra responsabilidad total ante usted por una
            reserva se limita al monto que usted nos pagó por el servicio afectado. No somos responsables
            de pérdidas indirectas, como vuelos o conexiones perdidos, noches de hotel o actividades
            reservadas por separado; por favor deje un margen de tiempo amplio antes de sus vuelos.
          </li>
          <li>
            Nada de lo dispuesto en estos términos limita los derechos que usted tiene según la ley
            costarricense de protección al consumidor (Ley N.º 7472) ni la responsabilidad que legalmente
            no puede limitarse, como la que surge por muerte o lesiones personales causadas por
            negligencia.
          </li>
          <li>
            Recomendamos contratar un seguro de viaje que cubra cancelación, gastos médicos y equipaje.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="force-majeure" title="9. Hechos fuera de nuestro control">
        <p>
          No somos responsables de los retrasos o las cancelaciones causados por hechos fuera del control
          razonable nuestro o de nuestros asociados, incluidos lluvias fuertes, tormentas, inundaciones,
          deslizamientos, cierres de carreteras, actividad volcánica, terremotos, cierres de parques,
          huelgas, órdenes del gobierno o medidas de salud pública. En esos casos ofrecemos una nueva
          fecha o el reembolso del servicio afectado, como se explica en la{" "}
          <Link href="/es/cancelacion">Política de cancelación</Link>.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="10. Cambios y cancelaciones">
        <p>
          Los cambios y las cancelaciones, ya sean de su parte o de la nuestra, se rigen por nuestra{" "}
          <Link href="/es/cancelacion">Política de cancelación</Link>.
        </p>
      </LegalSection>

      <LegalSection id="chat" title="11. Chat de su viaje y reseñas">
        <p>
          La página de su viaje incluye un chat con nuestro equipo y, una vez asignado, con su conductor.
          Por favor manténgalo respetuoso y dedicado a su viaje. Por su seguridad, en el chat no se
          pueden compartir números de teléfono, correos electrónicos ni enlaces entre viajeros y
          conductores; nuestro equipo puede compartir los datos de contacto cuando sea necesario. Si
          usted publica una reseña, debe tratar sobre su propio viaje y ser honesta.
        </p>
      </LegalSection>

      <LegalSection id="law" title="12. Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República de Costa Rica. Las controversias se
          someten a los tribunales competentes de Costa Rica, sin afectar los derechos de consumidor de
          carácter obligatorio que usted tenga en su país de residencia. Si tiene una queja, por favor
          contáctenos primero; intentaremos resolverla rápidamente y de buena fe.
        </p>
        <p>
          Podemos actualizar estos términos. A cada reserva se le aplica la versión vigente en el momento
          en que la confirmamos.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contacto">
        <p>
          Escriba a nuestro equipo por{" "}
          <a
            href={whatsAppLink("¡Hola! Tengo una pregunta sobre sus términos.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
          , en el chat de su viaje o a través de este sitio web. Operador: {LEGAL_ENTITY_PLACEHOLDER_ES}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
