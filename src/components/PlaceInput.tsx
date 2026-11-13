"use client";

import { Loader2, MapPin, Plane } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { AIRPORT_HUBS, HUBS } from "@/lib/catalog";
import { hubName } from "@/lib/catalogEs";
import { hubPlace, isHubPlace, type RidePlace } from "@/lib/places";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { usePublicLang, useT } from "./PublicLangContext";

interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
}

type Option =
  | { kind: "hub"; place: RidePlace }
  | { kind: "google"; s: Suggestion };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Pickup / drop-off box (docs/PRICING.md §2): our towns and airports appear at
 * once; typing 3+ letters adds Google suggestions in Costa Rica (hotels, docks,
 * restaurants, addresses). Google is only called through our server
 * (/api/places/*), with one session token per search so typing is billed once.
 */
export function PlaceInput({
  label,
  value,
  onChange,
  towns = true,
  placeholder,
}: {
  label: string;
  /** The chosen place; null for a search box that starts empty (a stop to add). */
  value: RidePlace | null;
  onChange: (p: RidePlace) => void;
  /** False: only typed places (no list of our towns), for "add your own stop". */
  towns?: boolean;
  placeholder?: string;
}) {
  const lang = usePublicLang();
  const t = useT();
  // Our towns are named in the page's language; a typed place keeps Google's name.
  const shown = !value ? "" : isHubPlace(value) ? hubName(value.hub, lang) : value.label;
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const [found, setFound] = useState<{ q: string; items: Suggestion[]; error?: string }>({ q: "", items: [] });
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState("");
  const [searchOff, setSearchOff] = useState(false);
  const session = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = open ? text.trim() : "";
  // Just opened (text is still the current place): list every town.
  const browsing = query === "" || query === shown;
  // Match the name in either language ("airport" and "aeropuerto" both find SJO).
  const hubs = towns
    ? HUBS.filter((h) => browsing || fold(h.name).includes(fold(query)) || fold(hubName(h.id, lang)).includes(fold(query)))
    : [];
  const wantGoogle = open && !browsing && query.length >= 3 && !searchOff;
  const google = wantGoogle && found.q === query ? found.items : [];
  const searching = wantGoogle && found.q !== query;
  const options: Option[] = [
    ...hubs.map((h) => ({ kind: "hub" as const, place: hubPlace(h.id) })),
    ...google.map((s) => ({ kind: "google" as const, s })),
  ];

  useEffect(() => {
    if (!wantGoogle) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      session.current ??= crypto.randomUUID();
      try {
        const res = await fetch(
          `/api/places/suggest?q=${encodeURIComponent(query)}&session=${session.current}`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as { suggestions?: Suggestion[]; disabled?: boolean; error?: string };
        if (data.disabled) setSearchOff(true);
        setFound({ q: query, items: data.suggestions ?? [], error: data.error });
      } catch {
        if (!ctrl.signal.aborted) setFound({ q: query, items: [], error: "Search isn't available right now." });
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [wantGoogle, query]);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  async function choose(o: Option) {
    setPickError("");
    if (o.kind === "hub") {
      onChange(o.place);
      close();
      inputRef.current?.blur();
      return;
    }
    setPicking(true);
    try {
      const q = new URLSearchParams({ id: o.s.placeId, label: o.s.main });
      if (session.current) q.set("session", session.current);
      const res = await fetch(`/api/places/lookup?${q}`);
      const data = (await res.json()) as { place?: RidePlace; error?: string };
      if (!data.place) throw new Error(data.error ?? "We couldn't find that place.");
      session.current = null; // the lookup ends this search session
      onChange(data.place);
      close();
      inputRef.current?.blur();
    } catch (e) {
      setPickError((e as Error).message || "We couldn't find that place.");
    } finally {
      setPicking(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && options[active]) {
      e.preventDefault();
      void choose(options[active]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  const rawError = pickError || (google.length === 0 && found.q === query ? found.error : "");
  const CLIENT_ES: Record<string, string> = {
    "Search isn't available right now.": "La búsqueda no está disponible en este momento.",
    "We couldn't find that place.": "No pudimos encontrar ese lugar.",
  };
  const error = rawError ? (lang === "es" ? (CLIENT_ES[rawError] ?? localizeServerMessage(rawError, lang)) : rawError) : "";

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-slate-600">
        {label}
      </label>
      <div className="relative">
        <MapPin className="w-4 h-4 text-emerald-700 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={open ? text : shown}
          placeholder={placeholder ?? t("Airport, town, hotel or address", "Aeropuerto, pueblo, hotel o dirección")}
          onFocus={(e) => {
            setText(shown);
            setOpen(true);
            setActive(-1);
            setPickError("");
            requestAnimationFrame(() => e.target.select());
          }}
          onBlur={close}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          className="w-full min-h-11 bg-white text-slate-900 border border-slate-300 rounded-xl pl-9 pr-9 text-base font-semibold truncate focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
        />
        {(picking || searching) && (
          <Loader2 className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" aria-hidden />
        )}
      </div>
      {open && (towns || !browsing || searchOff) && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          // Keep focus in the input while clicking an option.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-auto rounded-xl bg-white text-slate-900 shadow-xl border border-slate-200 py-1 text-[15px]"
        >
          {options.map((o, i) => {
            const isHub = o.kind === "hub";
            const first = i === 0 || options[i - 1].kind !== o.kind;
            return (
              <li key={isHub ? o.place.id : o.s.placeId} role="presentation">
                {first && (
                  <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider font-extrabold text-slate-500">
                    {isHub
                      ? t("Our towns & airports", "Nuestros destinos y aeropuertos")
                      : t("Hotels, places & addresses", "Hoteles, lugares y direcciones")}
                  </p>
                )}
                <div
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => void choose(o)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-11 items-center gap-2 px-3 py-2 cursor-pointer ${i === active ? "bg-emerald-50" : ""}`}
                >
                  {isHub && AIRPORT_HUBS.includes(o.place.hub) ? (
                    <Plane className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden />
                  ) : (
                    <MapPin className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden />
                  )}
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{isHub ? hubName(o.place.hub, lang) : o.s.main}</span>
                    {!isHub && o.s.secondary && <span className="block text-xs text-slate-500 truncate">{o.s.secondary}</span>}
                  </span>
                </div>
              </li>
            );
          })}
          {wantGoogle && !searching && google.length === 0 && !error && (
            <li className="px-3 py-2 text-xs text-slate-500">
              {t("No places found. Try a hotel name, town or address.", "No encontramos lugares. Pruebe con el nombre de un hotel, un pueblo o una dirección.")}
            </li>
          )}
          {browsing && !searchOff && towns && (
            <li className="px-3 py-2 text-xs text-slate-500">
              {t("Or type a hotel, dock, restaurant or address.", "O escriba un hotel, muelle, restaurante o dirección.")}
            </li>
          )}
          {searchOff && !towns && (
            <li className="px-3 py-2 text-xs text-slate-500">
              {t("Place search isn't available right now. Message us and we'll add your stop.", "La búsqueda de lugares no está disponible en este momento. Escríbanos y agregamos su parada.")}
            </li>
          )}
          {error && <li className="px-3 py-2 text-xs font-semibold text-red-700">{error}</li>}
          {google.length > 0 && (
            <li className="px-3 pt-1 pb-1.5 text-right text-xs text-slate-500">Powered by Google</li>
          )}
        </ul>
      )}
    </div>
  );
}
