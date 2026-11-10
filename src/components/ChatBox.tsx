"use client";

import { Lock, MessageCircle, Phone, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getChat, sendChat, type ChatMessage, type ChatViewer } from "@/app/chat/actions";
import { hideContactDetails } from "@/lib/contactFilter";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { teamLocale, type TeamLang } from "@/lib/teamLang";

const POLL_MS = 8000;

/**
 * Trip chat for one booking (traveller ↔ assigned driver; our team reads every thread
 * and can step in). New messages arrive by checking every few seconds while the page
 * is open: travellers on the website have no account, so live database subscriptions
 * aren't available to them. Contact details from travellers and drivers are hidden by
 * the server; this box only warns before sending and shows the server's notice.
 */
export function ChatBox({
  bookingId,
  viewer,
  intro,
  allowContactDetails = false,
  lang = "en",
}: {
  /** Team pages and the driver portal pass their language; the traveller's trip page passes the trip's. */
  lang?: TeamLang;
  bookingId: string;
  viewer: ChatViewer;
  intro?: string;
  /** The team may share phone numbers; travellers and drivers may not. */
  allowContactDetails?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [open, setOpen] = useState(true);
  const [closedNote, setClosedNote] = useState<string | null>(null);
  const [support, setSupport] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLOListElement>(null);
  const es = lang === "es";
  const willHide = !allowContactDetails && hideContactDetails(text).kinds.length > 0;

  // The viewer is a small object that callers recreate on every render; key on its contents.
  const viewerKey = JSON.stringify(viewer);
  const refresh = useCallback(async () => {
    const res = await getChat(bookingId, JSON.parse(viewerKey) as ChatViewer, lang);
    if (res.ok) {
      setMessages(res.messages);
      setOpen(res.open);
      setClosedNote(res.closedNote ?? null);
      setSupport(res.support);
      setError(null);
    } else setError(res.error);
  }, [bookingId, viewerKey, lang]);

  useEffect(() => {
    let stop = false;
    const tick = () => {
      if (!stop && document.visibilityState === "visible") void refresh();
    };
    tick();
    const t = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const count = messages?.length ?? 0;
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [count]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      const res = await sendChat(bookingId, viewer, text, lang);
      if (res.ok) {
        setMessages(res.messages);
        setNotice(res.notice ?? null);
        setText("");
        setError(null);
      } else setError(res.error);
    });
  }

  return (
    <div id={`chat-${bookingId}`} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white">
      <ol ref={list} aria-live="polite" className="max-h-96 space-y-2 overflow-y-auto p-3">
        {messages === null && <li className="text-sm text-slate-500">{es ? "Cargando mensajes…" : "Loading messages…"}</li>}
        {messages?.length === 0 && (
          <li className="text-sm text-slate-500">{intro ?? (es ? "Aún no hay mensajes. ¡Salude!" : "No messages yet. Say hello!")}</li>
        )}
        {messages?.map((m) => (
          <li key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.mine
                  ? "bg-emerald-700 text-white"
                  : m.party === "admin"
                    ? "bg-amber-50 text-slate-900 border border-amber-200"
                    : "bg-slate-100 text-slate-900"
              }`}
            >
              <p className={`text-xs font-bold ${m.mine ? "text-emerald-100" : "text-slate-500"}`}>
                {m.mine ? (es ? "Usted" : "You") : es ? (NAMES_ES[m.name] ?? m.name) : m.name} · {formatTime(m.at, lang)}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {notice && (
        <p role="status" className="mx-3 mb-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {open ? (
        <form onSubmit={send} className="border-t border-slate-100 p-3">
          <label className="sr-only" htmlFor={`chat-input-${bookingId}`}>
            {es ? "Mensaje" : "Message"}
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id={`chat-input-${bookingId}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder={es ? "Escriba un mensaje…" : "Write a message…"}
              className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 p-2.5 text-base sm:text-sm"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label={es ? "Enviar mensaje" : "Send message"}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          {willHide && (
            <p className="mt-2 text-xs font-semibold text-amber-800">
              {es
                ? "Por su seguridad, los teléfonos, correos y enlaces se ocultarán al enviar."
                : "For your safety, phone numbers, emails and links will be hidden when you send."}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
              {localizeServerMessage(error, lang)}
            </p>
          )}
        </form>
      ) : (
        <p className="flex items-start gap-2 border-t border-slate-100 p-3 text-sm text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {closedNote}
        </p>
      )}

      {!allowContactDetails && support && <TeamContact support={support} lang={lang} driver={viewer.kind === "staff"} />}
    </div>
  );
}

/**
 * "Call our team" / WhatsApp, under the chat for travellers and drivers. A masked
 * "Call the traveller" button (Twilio, later PR) belongs in this row too.
 */
function TeamContact({ support, lang, driver }: { support: string; lang: TeamLang; driver: boolean }) {
  const es = lang === "es";
  const hello = driver
    ? es
      ? "Hola, soy conductor socio y necesito ayuda con un viaje."
      : "Hi, I'm a partner driver and I need help with a trip."
    : es
      ? "Hola, necesito ayuda con mi viaje."
      : "Hi, I need help with my trip.";
  const btn = "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold";
  return (
    <div className="flex gap-2 border-t border-slate-100 p-3">
      <a href={`tel:+${support}`} className={`${btn} border border-emerald-700 text-emerald-800 hover:bg-emerald-50`}>
        <Phone className="h-4 w-4" aria-hidden />
        {es ? "Llamar a nuestro equipo" : "Call our team"}
      </a>
      <a
        href={`https://wa.me/${support}?text=${encodeURIComponent(hello)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        WhatsApp
      </a>
    </div>
  );
}

/** The stand-in names the server uses when it has no first name (src/app/chat/actions.ts). */
const NAMES_ES: Record<string, string> = { "Our team": "Nuestro equipo", Driver: "Conductor", Traveller: "Viajero" };

function formatTime(iso: string, lang: TeamLang): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "es" ? teamLocale(lang) : undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
