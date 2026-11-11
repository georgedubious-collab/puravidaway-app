import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY_PLACEHOLDER_ES, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { CookieSentence, MeasurementCollected, MeasurementPurpose, MeasurementRecipients, MeasurementRetention } from "@/components/legal/MeasurementText";
import { whatsAppLink } from "@/lib/cart";
import { bilingualAlternates } from "@/lib/publicLang";

export const metadata: Metadata = {
  title: "Política de privacidad | Costa Rica Private Transfers",
  description:
    "Qué datos personales recopila Costa Rica Private Transfers cuando usted solicita un viaje en Costa Rica o conduce con nosotros, para qué, con quién se comparten y cómo acceder a ellos o eliminarlos.",
  alternates: bilingualAlternates("/privacy", "es"),
};

/*
 * Spanish translation of src/app/privacy/page.tsx. The English page is the original:
 * change both together, section by section, and keep the same section ids.
 * Keep both in line with what the code actually stores (see the note in the English page).
 */
export default function PrivacidadPage() {
  return (
    <LegalPage
      updated="2026-11-11"
      lang="es"
      title="Política de privacidad"
      intro={
        <>
          <p>
            Esta política explica qué datos personales recopila Costa Rica Private Transfers, para qué, quién los
            recibe y qué derechos tiene usted. Cubre a los viajeros que solicitan viajes y a los conductores
            asociados que solicitan conducir con nosotros.
          </p>
          <p className="mt-3">
            Esta es una traducción de la versión en inglés. Si hubiera alguna diferencia entre ambas, prevalece la{" "}
            <Link href="/privacy" hrefLang="en">
              versión en inglés
            </Link>
            .
          </p>
        </>
      }
    >
      <LegalSection id="controller" title="1. Quién es responsable de sus datos">
        <p>
          El responsable de sus datos (“responsable” según la Ley N.º 8968 de Costa Rica, “responsable
          del tratamiento” según el RGPD de la Unión Europea) es{" "}
          <strong>{LEGAL_ENTITY_PLACEHOLDER_ES}</strong>, que opera como Costa Rica Private Transfers. Puede
          contactar a nuestro equipo como se indica en la sección 10.
        </p>
      </LegalSection>

      <LegalSection id="travellers" title="2. Qué datos recopilamos de los viajeros">
        <ul>
          <li>
            <strong>Datos de contacto:</strong> su nombre completo, su correo electrónico y su número de
            celular / WhatsApp, tomados del formulario de solicitud de viaje.
          </li>
          <li>
            <strong>Datos del viaje:</strong> los traslados, tours y expediciones que usted elige, las
            fechas, los lugares de recogida y de destino, el número de pasajeros, el vehículo, las
            paradas turísticas, el nivel de alojamiento, las preferencias del traslado (idioma del
            conductor, sillas para niños, coche de bebé, Wi-Fi, mascotas), los precios y la opción de
            pago que usted escoge.
          </li>
          <li>
            <strong>Las notas que usted agrega,</strong> como números de vuelo, hoteles, equipaje o
            cualquier otra cosa que nos cuente. Por favor no incluya información de salud ni otros datos
            sensibles, salvo que sean necesarios para su viaje.
          </li>
          <li>
            <strong>Los mensajes del chat de su viaje</strong> entre usted, nuestro equipo y su
            conductor, y cuándo se leyó cada mensaje.
          </li>
          <li>
            <strong>Los mensajes que nos envía por WhatsApp o por correo electrónico.</strong> WhatsApp
            es operado por Meta bajo su propia política de privacidad.
          </li>
          <li>
            <strong>Datos técnicos:</strong> cuando usted envía una solicitud de viaje, registramos
            brevemente su dirección IP (dirección de red) y su correo electrónico para detener el spam y
            el abuso (como máximo 5 solicitudes por hora por red y 3 por correo electrónico). Estos
            registros se eliminan automáticamente después de aproximadamente un día. Nuestro proveedor de
            alojamiento web también guarda registros estándar del servidor (dirección IP, navegador,
            páginas solicitadas) por seguridad y para resolver problemas.
          </li>
          <li>
            <strong>Búsqueda de lugares:</strong> cuando usted escribe un lugar de recogida o de destino,
            lo que escribe y el lugar que elige se envían desde nuestro servidor a Google Maps para
            encontrar el lugar y la distancia por carretera. No enviamos con ello su nombre ni sus datos
            de contacto. Los lugares que usted reserva se guardan con su reserva para que su conductor
            sepa adónde ir.
          </li>
          <li>
            <strong>Estadísticas de visitas sin cookies:</strong> usamos Vercel Web Analytics para contar las visitas
            a las páginas, qué páginas son populares, y el país y el tipo de dispositivo del visitante.
            No usa cookies y no lo identifica ni lo sigue a otros sitios web.
          </li>
          <MeasurementCollected lang="es" />
          <li>
            <strong>En su dispositivo:</strong> el sitio guarda su viaje en preparación en el
            almacenamiento local de su navegador para que no se pierda si recarga la página. Se queda en
            su dispositivo y usted puede borrarlo en cualquier momento. <CookieSentence lang="es" />
          </li>
        </ul>
        <p>
          <strong>No</strong> recopilamos ni guardamos números de tarjeta. Cuando el pago en línea esté
          disponible, lo procesará un proveedor de pagos en sus propios sistemas seguros; nosotros
          recibimos solo el resultado del pago (monto, estado, referencia).
        </p>
      </LegalSection>

      <LegalSection id="drivers" title="3. Qué datos recopilamos de los conductores asociados">
        <ul>
          <li>Correo electrónico de inicio de sesión, nombre completo y número de WhatsApp.</li>
          <li>
            <strong>Documentos y datos de verificación (KYC):</strong> su foto, su cédula o pasaporte
            (número e imágenes), su licencia de conducir (número, vencimiento, imagen), su certificado de
            antecedentes penales y la fecha de este, y, de forma opcional, su permiso de transporte
            turístico del ICT.
          </li>
          <li>
            <strong>Datos del vehículo:</strong> placa, marca, modelo, año, color, capacidad,
            equipamiento, fotos del vehículo, póliza de seguro del INS, inspección Dekra / RTV, Marchamo
            e inscripción del vehículo, con sus números y fechas de vencimiento.
          </li>
          <li>
            El texto de su perfil, su nivel de inglés, sus ofertas, los viajes asignados y los mensajes
            de chat.
          </li>
          <li>
            <strong>Ubicación durante los viajes (app de conductores):</strong> si usted lo acepta en la
            app, su teléfono comparte su ubicación con nuestro equipo desde 3 horas antes de una recogida
            (o desde que usted toca “Voy en camino”) hasta que usted termina el viaje, incluso cuando la
            app está en segundo plano. Antes de la recogida la usamos, junto con los datos de tráfico en
            vivo de Google Maps, para estimar su hora de llegada. No se comparte nada fuera de ese
            período. Guardamos solo su última posición, no un historial. La ven nuestro equipo y, durante
            ese período, los viajeros a quienes usted transporta (en la página de su viaje y en su app),
            y usted puede dejar de compartirla en la app en cualquier momento.
          </li>
        </ul>
        <p>
          Los documentos y números de KYC se guardan en un área de almacenamiento privada que solo usted
          y nuestro equipo de administración pueden abrir. Los viajeros nunca ven los números de su
          cédula, su licencia o su seguro; ven su nombre de pila, su foto, el texto de su perfil, sus
          idiomas, sus insignias de cumplimiento y las fotos de su vehículo una vez que usted es asignado
          a su viaje.
        </p>
      </LegalSection>

      <LegalSection id="why" title="4. Para qué los usamos (finalidades y bases legales)">
        <ul>
          <li>
            <strong>Para atender su solicitud y cumplir con su reserva</strong> (contrato): revisar la
            disponibilidad, confirmar, coordinar conductores y operadores, enviar confirmaciones y
            notificaciones del chat de su viaje, y darle apoyo durante el viaje.
          </li>
          <li>
            <strong>Para verificar a los conductores y proteger a los viajeros</strong> (obligaciones
            legales y nuestro interés legítimo): comprobar la identidad, las licencias, los permisos, el
            seguro y los documentos del vehículo.
          </li>
          <li>
            <strong>Para prevenir el spam, el fraude y el abuso</strong> (interés legítimo): límites de
            frecuencia de solicitudes y filtrado de los datos de contacto en el chat entre viajeros y
            conductores.
          </li>
          <li>
            <strong>Registros contables, tributarios y legales</strong> (obligación legal).
          </li>
          <MeasurementPurpose lang="es" />
        </ul>
        <p>
          Al enviar una solicitud de viaje o una solicitud para ser conductor, usted da su consentimiento
          informado, como lo exige la Ley N.º 8968, para este uso de sus datos. No vendemos sus datos y
          no enviamos mensajes de mercadeo a menos que usted los pida.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="5. Quién recibe sus datos">
        <ul>
          <li>
            <strong>Su conductor asociado</strong> ve lo que necesita para hacer su trabajo: los datos de
            su viaje, su nombre de pila y las notas de recogida, y su número de teléfono solo a partir
            del día anterior al viaje. Los conductores que revisan las solicitudes abiertas ven las
            localidades, la fecha, el vehículo y el número de pasajeros, nunca su nombre ni sus datos de
            contacto.
          </li>
          <li>
            <strong>Los operadores externos</strong> (botes, alojamientos, guías, parques, el SINAC para
            los permisos de parques) reciben los nombres y los datos necesarios para reservar sus
            servicios.
          </li>
          <li>
            <strong>Proveedores de servicios que tratan datos por cuenta nuestra:</strong> Supabase (base
            de datos, inicio de sesión y almacenamiento de archivos, alojado en Estados Unidos), Vercel
            (alojamiento del sitio web y registros del servidor, Estados Unidos y red global), Resend
            (envío de nuestros correos electrónicos, Estados Unidos), Google Maps (búsqueda de lugares y
            distancias por carretera, Estados Unidos) y, cuando se habilite el pago en línea, nuestro
            proveedor de pagos. Pueden usar los datos únicamente para prestarnos su servicio.
          </li>
          <MeasurementRecipients lang="es" />
          <li>Las autoridades, cuando la ley lo exige.</li>
        </ul>
      </LegalSection>

      <LegalSection id="transfers" title="6. Transferencias internacionales">
        <p>
          Nuestros proveedores de servicios almacenan datos fuera de Costa Rica y de la Unión Europea,
          principalmente en Estados Unidos. Usamos proveedores que ofrecen garantías contractuales (como
          las Cláusulas Contractuales Tipo de la Comisión Europea) para estas transferencias.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="7. Cuánto tiempo los conservamos">
        <ul>
          <li>
            <strong>Las reservas, los pagos y los mensajes relacionados</strong> se conservan como
            registros contables durante el tiempo que exige la legislación tributaria y comercial de
            Costa Rica.
          </li>
          <li>
            <strong>Las solicitudes de viaje que nunca se convirtieron en reservas</strong> se eliminan o
            se anonimizan cuando ya no son necesarias para responderle.
          </li>
          <li>
            <strong>Los registros antispam</strong> (dirección IP y correo electrónico) se eliminan
            después de aproximadamente un día.
          </li>
          <li>
            <strong>Los documentos KYC de los conductores</strong> se conservan mientras usted conduce
            con nosotros y, después, durante el tiempo que los necesitemos para atender reclamos, asuntos
            de seguros o solicitudes legales; luego se eliminan.
          </li>
          <MeasurementRetention lang="es" />
        </ul>
      </LegalSection>

      <LegalSection id="rights" title="8. Sus derechos">
        <p>
          Según la Ley N.º 8968 de Costa Rica (Ley de Protección de la Persona frente al Tratamiento de
          sus Datos Personales), usted tiene derecho a acceder a sus datos personales, corregirlos y
          eliminarlos (derechos de acceso, rectificación y cancelación). Si usted se encuentra en la
          Unión Europea o en el Reino Unido, el RGPD le da además derecho a:
        </p>
        <ul>
          <li>obtener una copia de sus datos (acceso y portabilidad);</li>
          <li>que se corrijan;</li>
          <li>
            que se eliminen, salvo que debamos conservarlos, por ejemplo como registros contables;
          </li>
          <li>oponerse al uso que les damos o restringirlo;</li>
          <li>retirar su consentimiento en cualquier momento, sin afectar el uso anterior.</li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos, escríbanos (sección 10) desde el correo electrónico
          o el número de teléfono que usó, o incluya su referencia de reserva, para que podamos comprobar
          que es usted. Respondemos en un plazo de 5 días hábiles, como lo exige la Ley N.º 8968, y a más
          tardar en un mes.
        </p>
        <p>
          Si no queda satisfecho, puede presentar una queja ante la agencia de protección de datos de
          Costa Rica, la Agencia de Protección de Datos de los Habitantes (PRODHAB), o ante la autoridad
          de protección de datos de su país de la Unión Europea.
        </p>
      </LegalSection>

      <LegalSection id="security" title="9. Seguridad y menores de edad">
        <p>
          El acceso a los datos personales está limitado según el rol (viajero, conductor, nuestro
          equipo), los datos de contacto de los viajeros se guardan en un área separada que los
          conductores no pueden leer, y los datos viajan cifrados (HTTPS). Ningún sistema es
          perfectamente seguro; si una violación de seguridad lo afecta, se lo informaremos a usted y a
          las autoridades como lo exige la ley.
        </p>
        <p>
          Las solicitudes de viaje deben ser enviadas por una persona adulta. Recopilamos datos sobre
          niños solo como parte de una reserva hecha por su padre, madre o tutor (por ejemplo, la edad de
          un niño para una silla para niños).
        </p>
      </LegalSection>

      <LegalSection id="contact" title="10. Contacto y cambios">
        <p>
          Para preguntas o solicitudes sobre privacidad, escriba a nuestro equipo por{" "}
          <a
            href={whatsAppLink("¡Hola! Tengo una solicitud sobre privacidad.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>{" "}
          o en el chat de su viaje. Operador: {LEGAL_ENTITY_PLACEHOLDER_ES}.
        </p>
        <p>
          Actualizaremos esta página cuando cambie lo que recopilamos y mostraremos la nueva fecha en la
          parte superior. Vea también nuestros <Link href="/es/terminos">Términos del servicio</Link> y
          nuestra <Link href="/es/cancelacion">Política de cancelación</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
