"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getChat, sendChat, type ChatMessage, type ChatViewer } from "@/app/chat/actions";
import { hasContactDetails } from "@/lib/preferences";

const POLL_MS = 8000;

/**
 * Trip chat for one booking. New messages arrive by checking every few
 * seconds while the page is open (travellers have no account, so live
 * database subscriptions aren't available to them).
 */
export function ChatBox({
  bookingId,
  viewer,
  intro,
  allowContactDetails = false,
}: {
  bookingId: string;
  viewer: ChatViewer;
  intro?: string;
  /** The team may share phone numbers; travellers and drivers may not. */
  allowContactDetails?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLOListElement>(null);
  const blocked = !allowContactDetails && hasContactDetails(text);

  // The viewer is a small object that callers recreate on every render; key on its contents.
  const viewerKey = JSON.stringify(viewer);
  const refresh = useCallback(async () => {
    const res = await getChat(bookingId, JSON.parse(viewerKey) as ChatViewer);
    if (res.ok) {
      setMessages(res.messages);
      setError(null);
    } else setError(res.error);
  }, [bookingId, viewerKey]);

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
    if (!text.trim() || blocked) return;
    startTransition(async () => {
      const res = await sendChat(bookingId, viewer, text);
      if (res.ok) {
        setMessages(res.messages);
        setText("");
        setError(null);
      } else setError(res.error);
    });
  }

  return (
    <div id={`chat-${bookingId}`} className="rounded-xl border border-slate-200 bg-white">
      <ol ref={list} aria-live="polite" className="max-h-80 space-y-2 overflow-y-auto p-3">
        {messages === null && <li className="text-sm text-slate-400">Loading messages…</li>}
        {messages?.length === 0 && (
          <li className="text-sm text-slate-500">{intro ?? "No messages yet. Say hello!"}</li>
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
              <p className={`text-[11px] font-bold ${m.mine ? "text-emerald-100" : "text-slate-500"}`}>
                {m.mine ? "You" : m.name} · {formatTime(m.at)}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={send} className="border-t border-slate-100 p-3">
        <label className="sr-only" htmlFor={`chat-input-${bookingId}`}>
          Message
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
            placeholder="Write a message…"
            className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 p-2.5 text-base sm:text-sm"
          />
          <button
            type="submit"
            disabled={pending || !text.trim() || blocked}
            aria-label="Send message"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        {blocked && (
          <p className="mt-2 text-xs font-semibold text-red-700">
            Please leave out phone numbers, emails and links. Our team shares contact details when needed.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
