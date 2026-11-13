"use client";

import { useCallback, useEffect, useState } from "react";
import { removeSubscription, saveSubscription, sendTestAlert } from "@/app/admin/alerts/actions";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { btn, Card, Notice } from "./ui";

/**
 * "Alertas en este teléfono": switch team alerts on or off for this phone / browser, send a
 * test, and on an iPhone that hasn't added the admin to its home screen, the steps to do it
 * (Apple only allows web notifications from a home-screen app, iOS 16.4 or later).
 */

type State = "loading" | "unsupported" | "ios-install" | "ios-old" | "not-configured" | "denied" | "off" | "on";

const SW_URL = "/admin-sw.js";
const SW_SCOPE = "/admin";

function keyBytes(b64u: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
  const raw = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function iosVersion(): number | null {
  const m = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** "iPhone · Safari", "Android · Chrome": so the team can tell their phones apart. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Computer";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  return `${device} · ${isStandalone() ? "app" : browser}`;
}

function subscriptionInput(sub: PushSubscription) {
  const j = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "", label: deviceLabel() };
}

export function PushAlertsCard({ lang, publicKey, myPhones }: { lang: TeamLang; publicKey: string; myPhones: number }) {
  const t = makeT(lang);
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "amber"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (isIos() && !isStandalone()) {
      const v = iosVersion();
      setState(v !== null && v < 16.4 ? "ios-old" : "ios-install");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (!publicKey) {
      setState("not-configured");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub && Notification.permission === "granted") {
      setState("on");
      // Keep the server's copy current (new keys, or this phone was handed to another admin).
      void saveSubscription(subscriptionInput(sub));
    } else setState("off");
  }, [publicKey]);

  useEffect(() => {
    // Browser-only checks (service worker, notification permission) once the page is shown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const r = await saveSubscription(subscriptionInput(sub));
      if (!r.ok) {
        setMsg({ tone: "red", text: r.error });
        return;
      }
      setState("on");
      setMsg({ tone: "green", text: t("Listo: este teléfono recibirá las alertas del equipo.", "Done: this phone will get the team's alerts.") });
    } catch (e) {
      console.error(e);
      setMsg({ tone: "red", text: t("No se pudo activar en este navegador. Inténtelo de nuevo.", "Couldn't switch on in this browser. Please try again.") });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMsg({ tone: "amber", text: t("Alertas desactivadas en este teléfono.", "Alerts switched off on this phone.") });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendTestAlert();
      setMsg(
        r.ok
          ? { tone: "green", text: t(`Prueba enviada a ${r.pushed} teléfono(s). Debería aparecer en unos segundos.`, `Test sent to ${r.pushed} phone(s). It should appear within seconds.`) }
          : { tone: "red", text: r.error },
      );
    } finally {
      setBusy(false);
    }
  }

  const status: Record<State, React.ReactNode> = {
    loading: <p className="text-sm text-[#5F6F67]">{t("Revisando este teléfono…", "Checking this phone…")}</p>,
    unsupported: (
      <Notice tone="grey">
        {t(
          "Este navegador no permite notificaciones web. En Android use Chrome; en computadora, Chrome, Edge o Firefox; en iPhone, vea los pasos al abrirlo en Safari.",
          "This browser doesn't support web notifications. On Android use Chrome; on a computer, Chrome, Edge or Firefox; on iPhone, open it in Safari for the steps.",
        )}
      </Notice>
    ),
    "ios-old": (
      <Notice tone="amber">
        {t(
          "Las alertas en iPhone necesitan iOS 16.4 o más reciente. Actualice el iPhone en Ajustes › General › Actualización de software.",
          "Alerts on iPhone need iOS 16.4 or later. Update the iPhone in Settings › General › Software Update.",
        )}
      </Notice>
    ),
    "ios-install": <IosSteps lang={lang} />,
    "not-configured": (
      <Notice tone="amber">
        {t(
          "Las alertas al teléfono aún no están configuradas: faltan las claves VAPID en Vercel. Mientras tanto, las alertas siguen llegando por correo.",
          "Phone alerts aren't set up yet: the VAPID keys are missing in Vercel. Meanwhile, alerts keep arriving by email.",
        )}
      </Notice>
    ),
    denied: (
      <Notice tone="red">
        {t(
          "Las notificaciones están bloqueadas para este sitio. Permítalas en los ajustes del navegador (en iPhone: Ajustes › Notificaciones › CRPT Admin) y vuelva a esta página.",
          "Notifications are blocked for this site. Allow them in the browser's settings (on iPhone: Settings › Notifications › CRPT Admin) and come back to this page.",
        )}
      </Notice>
    ),
    off: (
      <p className="text-sm text-[#33443C]">
        {t("Las alertas están desactivadas en este teléfono.", "Alerts are off on this phone.")}
      </p>
    ),
    on: (
      <p className="flex items-center gap-2 text-sm font-bold text-[#065F46]">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
        {t("Activadas en este teléfono.", "On for this phone.")}
      </p>
    ),
  };

  return (
    <Card title={t("Alertas en este teléfono", "Alerts on this phone")} id="push-card">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[#5F6F67]">
          {t(
            "Reciba en este teléfono los avisos urgentes del equipo (conductor atrasado, viaje sin conductor, reserva para hoy…), también de noche. El correo sigue llegando igual. Cada miembro del equipo activa sus propios teléfonos.",
            "Get the team's urgent alerts on this phone (late driver, trip without a driver, booking for tonight…), at night too. Email keeps arriving as before. Each team member switches on their own phones.",
          )}
        </p>
        <div aria-live="polite">{status[state]}</div>
        {(state === "off" || state === "on") && (
          <div className="flex flex-wrap gap-2">
            {state === "off" ? (
              <button type="button" className={btn.primary} onClick={enable} disabled={busy}>
                {t("Activar alertas en este teléfono", "Switch on alerts on this phone")}
              </button>
            ) : (
              <>
                <button type="button" className={btn.primary} onClick={test} disabled={busy}>
                  {t("Enviar una prueba", "Send a test")}
                </button>
                <button type="button" className={btn.secondary} onClick={disable} disabled={busy}>
                  {t("Desactivar en este teléfono", "Switch off on this phone")}
                </button>
              </>
            )}
          </div>
        )}
        {msg && (
          <Notice tone={msg.tone} role={msg.tone === "red" ? "alert" : "status"}>
            {msg.text}
          </Notice>
        )}
        <p className="text-xs text-[#5F6F67]">
          {myPhones === 1
            ? t("Usted tiene 1 teléfono o navegador con alertas activadas.", "You have 1 phone or browser with alerts on.")
            : t(`Usted tiene ${myPhones} teléfonos o navegadores con alertas activadas.`, `You have ${myPhones} phones or browsers with alerts on.`)}
        </p>
      </div>
    </Card>
  );
}

function IosSteps({ lang }: { lang: TeamLang }) {
  const t = makeT(lang);
  const steps = [
    t("Abra esta página en Safari (no dentro de WhatsApp ni de otra app).", "Open this page in Safari (not inside WhatsApp or another app)."),
    t("Toque el botón Compartir (el cuadrado con la flecha hacia arriba).", "Tap the Share button (the square with the arrow pointing up)."),
    t("Elija «Agregar a inicio» y toque «Agregar». Aparece el ícono «CRPT Admin».", "Choose \"Add to Home Screen\" and tap \"Add\". The \"CRPT Admin\" icon appears."),
    t("Abra CRPT Admin desde ese ícono e inicie sesión.", "Open CRPT Admin from that icon and sign in."),
    t("Vuelva a «Alertas en este teléfono», toque «Activar» y luego «Permitir».", "Come back to \"Alerts on this phone\", tap \"Switch on\" and then \"Allow\"."),
  ];
  return (
    <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#78350F]">
      <p className="font-extrabold">
        {t("En iPhone, primero agregue el admin a la pantalla de inicio", "On iPhone, first add the admin to your home screen")}
      </p>
      <p className="mt-1 leading-relaxed">
        {t(
          "Apple solo permite notificaciones de sitios web agregados a la pantalla de inicio (iOS 16.4 o más reciente).",
          "Apple only allows notifications from websites added to the home screen (iOS 16.4 or later).",
        )}
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
