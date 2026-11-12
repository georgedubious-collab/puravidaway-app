import { CLARITY_ID, GA_ID, GOOGLE_ADS_ID, HAS_ADS_TOOLS, HAS_ANALYTICS_TOOLS, HAS_CONSENT_TOOLS, META_PIXEL_ID } from "@/lib/analyticsConfig";
import { t, type PublicLang } from "@/lib/publicLang";

/*
 * The parts of the Privacy Policy (English and Spanish) about cookies and measurement tools.
 * Each paragraph is shown only when its tool is switched on in Vercel (docs/SEO.md §7), so the
 * page always describes what the site really does: with no tool set, it still says "We don't
 * use advertising or tracking cookies".
 *
 * Keep in line with src/lib/analytics.ts (what is loaded and sent), src/lib/consentRegion.ts
 * (who is asked first: the EEA, the UK and Switzerland) and with the settings in each tool's
 * own account (retention times below are the tools' defaults).
 * Pending legal review, like the rest of the legal pages.
 */

const adsNames = (lang: PublicLang) =>
  [GOOGLE_ADS_ID && "Google Ads", META_PIXEL_ID && t(lang, "the Meta pixel (Facebook and Instagram)", "el píxel de Meta (Facebook e Instagram)")]
    .filter(Boolean)
    .join(t(lang, " and ", " y "));

/** Section 2: list items after "Visit statistics". */
export function MeasurementCollected({ lang }: { lang: PublicLang }) {
  return (
    <>
      {GA_ID && (
        <li>
          <strong>{t(lang, "Google Analytics (in Europe, only if you accept):", "Google Analytics (en Europa, solo si usted acepta):")}</strong>{" "}
          {t(
            lang,
            "Google Analytics 4 records which pages you view, roughly where you are (country and city, worked out from your IP address, which Google Analytics does not store), your device and browser, how you reached the site, and the booking steps you use (the route as town codes, the vehicle class, the price, and whether a request was sent). It uses cookies on your device (_ga and _ga_…, kept for up to two years) to tell a returning visitor from a new one. We never send it your name, email, phone number, notes, the places you type, booking references or trip links, and it never runs on your private trip page. If you are in the European Economic Area, the United Kingdom or Switzerland, we ask you first in a cookie notice: Google Analytics runs only if you choose “Accept” (or tick “Analytics”), and until then it is not loaded at all and sets no cookies. Everywhere else it is on by default, and you can switch it off at any time with “Cookie settings” at the bottom of every page.",
            "Google Analytics 4 registra qué páginas ve, dónde se encuentra de forma aproximada (país y ciudad, calculados a partir de su dirección IP, que Google Analytics no guarda), su dispositivo y navegador, cómo llegó al sitio y los pasos de la reserva que utiliza (la ruta como códigos de localidad, la categoría de vehículo, el precio y si se envió una solicitud). Usa cookies en su dispositivo (_ga y _ga_…, que se conservan hasta dos años) para distinguir a un visitante que regresa de uno nuevo. Nunca le enviamos su nombre, correo electrónico, número de teléfono, notas, los lugares que usted escribe, referencias de reserva ni enlaces de viaje, y nunca se ejecuta en la página privada de su viaje. Si usted se encuentra en el Espacio Económico Europeo, el Reino Unido o Suiza, primero se lo preguntamos en un aviso de cookies: Google Analytics solo funciona si usted elige “Aceptar” (o marca “Analítica”), y hasta entonces no se carga y no coloca ninguna cookie. En el resto del mundo está activado de forma predeterminada, y usted puede desactivarlo en cualquier momento con “Configuración de cookies”, al pie de cada página.",
          )}
        </li>
      )}
      {CLARITY_ID && (
        <li>
          <strong>{t(lang, "Microsoft Clarity (analytics; in Europe, only if you accept):", "Microsoft Clarity (analítica; en Europa, solo si usted acepta):")}</strong>{" "}
          {t(
            lang,
            "it records how the pages are used (clicks, scrolling and a replay of the visit, with the text on the page and anything typed into forms hidden) so we can find and fix confusing screens. It uses cookies (_clck, kept for up to one year, and _clsk, one day). It follows your analytics choice: in the European Economic Area, the United Kingdom and Switzerland only if you accept, elsewhere on until you switch analytics off.",
            "registra cómo se usan las páginas (clics, desplazamiento y una reproducción de la visita, con el texto de la página y lo que se escribe en los formularios ocultos) para que podamos encontrar y corregir pantallas confusas. Usa cookies (_clck, que se conserva hasta un año, y _clsk, un día). Sigue su elección sobre la analítica: en el Espacio Económico Europeo, el Reino Unido y Suiza solo si usted acepta; en el resto del mundo, activado hasta que usted desactive la analítica.",
          )}
        </li>
      )}
      {HAS_ADS_TOOLS && (
        <li>
          <strong>
            {t(lang, "Advertising measurement (in Europe, only if you accept advertising):", "Medición de publicidad (en Europa, solo si usted acepta la publicidad):")}
          </strong>{" "}
          {t(
            lang,
            `${adsNames(lang)} record that you visited the site, so we can tell whether our ads bring visits and trip requests, and may use it to show you our ads on their platforms. They use cookies (such as _gcl_au or _fbp, kept for up to 90 days). We don’t send them your name or contact details. In the European Economic Area, the United Kingdom and Switzerland they run only if you accept advertising; elsewhere they are on by default and you can switch them off with “Cookie settings”.`,
            `${adsNames(lang)} registran que usted visitó el sitio, para que sepamos si nuestros anuncios traen visitas y solicitudes de viaje, y pueden usarlo para mostrarle nuestros anuncios en sus plataformas. Usan cookies (como _gcl_au o _fbp, que se conservan hasta 90 días). No les enviamos su nombre ni sus datos de contacto. En el Espacio Económico Europeo, el Reino Unido y Suiza solo funcionan si usted acepta la publicidad; en el resto del mundo están activadas de forma predeterminada y usted puede desactivarlas con “Configuración de cookies”.`,
          )}
        </li>
      )}
    </>
  );
}

/** Section 2, end of "On your device": what the site says about cookies. */
export function CookieSentence({ lang }: { lang: PublicLang }) {
  if (!HAS_CONSENT_TOOLS) {
    return <>{t(lang, "We don’t use advertising or tracking cookies.", "No usamos cookies de publicidad ni de rastreo.")}</>;
  }
  const kinds =
    HAS_ANALYTICS_TOOLS && HAS_ADS_TOOLS
      ? t(lang, "analytics and advertising", "analítica y de publicidad")
      : HAS_ADS_TOOLS
        ? t(lang, "advertising", "publicidad")
        : t(lang, "analytics", "analítica");
  return (
    <>
      {t(
        lang,
        `Your cookie choice is saved there too. A small cookie of ours (crpt-region, kept for 30 days) remembers only whether you are visiting from the European Economic Area, the United Kingdom or Switzerland; we work this out from your IP address when a page loads and don’t keep the address. If you are, we use ${kinds} cookies only if you accept them, and we ask again after six months. Everywhere else they are on by default. No cookie is needed to book. You can change or withdraw your choice at any time with “Cookie settings” at the bottom of every page: from that moment the tools are switched off and their cookies for this site are deleted from your browser.`,
        `Allí también se guarda su elección sobre las cookies. Una pequeña cookie nuestra (crpt-region, que se conserva 30 días) recuerda solo si usted nos visita desde el Espacio Económico Europeo, el Reino Unido o Suiza; lo calculamos a partir de su dirección IP al cargar una página y no guardamos la dirección. Si es así, usamos cookies de ${kinds} solo si usted las acepta, y se lo volvemos a preguntar después de seis meses. En el resto del mundo están activadas de forma predeterminada. No se necesita ninguna cookie para reservar. Usted puede cambiar o retirar su elección en cualquier momento con “Configuración de cookies”, al pie de cada página: desde ese momento las herramientas se desactivan y sus cookies de este sitio se eliminan de su navegador.`,
      )}
    </>
  );
}

/** Section 4: purpose and legal basis. */
export function MeasurementPurpose({ lang }: { lang: PublicLang }) {
  if (!HAS_CONSENT_TOOLS) return null;
  return (
    <li>
      <strong>
        {HAS_ADS_TOOLS
          ? t(lang, "To understand how the site is used, improve it and measure our ads", "Para entender cómo se usa el sitio, mejorarlo y medir nuestros anuncios")
          : t(lang, "To understand how the site is used and improve it", "Para entender cómo se usa el sitio y mejorarlo")}
      </strong>{" "}
      {t(
        lang,
        "(in the European Economic Area, the United Kingdom and Switzerland, your consent; elsewhere, our legitimate interest in knowing how the site is used, which you can object to at any time with “Cookie settings”): the tools described in section 2. Saying no changes nothing else on the site, and you can withdraw your consent or switch the tools off at any time.",
        "(en el Espacio Económico Europeo, el Reino Unido y Suiza, su consentimiento; en el resto del mundo, nuestro interés legítimo en saber cómo se usa el sitio, al que usted puede oponerse en cualquier momento con “Configuración de cookies”): las herramientas descritas en la sección 2. Decir que no no cambia nada más en el sitio, y usted puede retirar su consentimiento o desactivar las herramientas en cualquier momento.",
      )}
    </li>
  );
}

/** Section 5: who receives the data. */
export function MeasurementRecipients({ lang }: { lang: PublicLang }) {
  if (!HAS_CONSENT_TOOLS) return null;
  const who = [
    (GA_ID || GOOGLE_ADS_ID) &&
      t(
        lang,
        `Google (${[GA_ID && "Google Analytics", GOOGLE_ADS_ID && "Google Ads"].filter(Boolean).join(", ")}; Google Ireland Limited for visitors in Europe, Google LLC in the United States)`,
        `Google (${[GA_ID && "Google Analytics", GOOGLE_ADS_ID && "Google Ads"].filter(Boolean).join(", ")}; Google Ireland Limited para visitantes en Europa, Google LLC en Estados Unidos)`,
      ),
    CLARITY_ID && t(lang, "Microsoft (Clarity, United States)", "Microsoft (Clarity, Estados Unidos)"),
    META_PIXEL_ID && t(lang, "Meta (the Meta pixel, United States and Ireland)", "Meta (el píxel de Meta, Estados Unidos e Irlanda)"),
  ].filter(Boolean);
  return (
    <li>
      <strong>{t(lang, "Measurement tools (section 2 says when they run):", "Herramientas de medición (la sección 2 indica cuándo funcionan):")}</strong>{" "}
      {who.join("; ")}.{" "}
      {t(
        lang,
        "They receive the usage data described in section 2, never your name or contact details, and handle it under their own privacy policies.",
        "Reciben los datos de uso descritos en la sección 2, nunca su nombre ni sus datos de contacto, y los tratan según sus propias políticas de privacidad.",
      )}
    </li>
  );
}

/** Section 7: how long it is kept. */
export function MeasurementRetention({ lang }: { lang: PublicLang }) {
  if (!HAS_CONSENT_TOOLS) return null;
  return (
    <li>
      <strong>{t(lang, "Data in the measurement tools:", "Los datos en las herramientas de medición:")}</strong>{" "}
      {GA_ID &&
        t(
          lang,
          "Google Analytics keeps the visit data linked to a cookie for 2 months (its standard setting, which we have not extended); after that only totals that identify no one remain. ",
          "Google Analytics conserva durante 2 meses los datos de visita vinculados a una cookie (su configuración estándar, que no hemos ampliado); después solo quedan totales que no identifican a nadie. ",
        )}
      {CLARITY_ID &&
        t(
          lang,
          "Microsoft Clarity keeps recordings for about 30 days and summary statistics for up to 13 months. ",
          "Microsoft Clarity conserva las grabaciones unos 30 días y las estadísticas resumidas hasta 13 meses. ",
        )}
      {HAS_ADS_TOOLS &&
        t(
          lang,
          "The advertising tools keep their data for the periods set in their own policies. ",
          "Las herramientas de publicidad conservan sus datos durante los plazos que fijan sus propias políticas. ",
        )}
      {t(
        lang,
        "The cookies themselves last as described in section 2, or until you switch the tools off.",
        "Las cookies duran lo indicado en la sección 2, o hasta que usted desactive las herramientas.",
      )}
    </li>
  );
}
