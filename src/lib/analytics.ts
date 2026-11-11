/**
 * Cookie choice + marketing measurement, browser only (docs/SEO.md §7).
 * Server code must not import this file; shared settings are in analyticsConfig.ts.
 *
 * Rules this file keeps:
 * - Nothing is loaded before the visitor accepts. Google's tag is not on the page at all
 *   until then (Consent Mode v2 "basic": default denied, then the visitor's choice).
 * - Nothing is ever loaded or sent on private pages (/admin, /driver, /trip/<secret link>…).
 * - Events carry no personal data: town codes, page addresses without their "?…" part,
 *   vehicle class ids and prices only. Never names, emails, phones, notes, typed places,
 *   booking references or trip links.
 * - Every track…() call does nothing without consent or without an id, so call sites stay one line.
 */
import "client-only";
import {
  CLARITY_ID,
  CONSENT_MAX_AGE_DAYS,
  GA_ID,
  GOOGLE_ADS_ID,
  HAS_ADS_TOOLS,
  HAS_ANALYTICS_TOOLS,
  META_PIXEL_ID,
  isPrivatePath,
} from "./analyticsConfig";
import type { CartItem, PaymentMode } from "./cart";

/* ───────────────────────── The visitor's choice ───────────────────────── */

export interface ConsentChoice {
  analytics: boolean;
  ads: boolean;
}

const STORAGE_KEY = "crpt-consent-v1";
const CHANGE_EVENT = "crpt-consent-change";
const OPEN_EVENT = "crpt-consent-open";
/** Which groups the banner offered when the choice was made: a new group means we ask again. */
const SCOPE = `${HAS_ANALYTICS_TOOLS ? "a" : ""}${HAS_ADS_TOOLS ? "m" : ""}`;

/** Used when the browser refuses localStorage (private windows): the choice lasts for this page only. */
let memoryRaw = "";

/** The stored choice as text ("" = none). Cheap and stable, for useSyncExternalStore. */
export function readConsentRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryRaw;
  } catch {
    return memoryRaw;
  }
}

/** The choice, or null when there is none, it is older than six months, or a new group was added since. */
export function parseConsent(raw: string, now: number = Date.now()): ConsentChoice | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { v?: unknown; a?: unknown; m?: unknown; s?: unknown; t?: unknown };
    if (v.v !== 1 || typeof v.t !== "number" || typeof v.s !== "string") return null;
    const ageDays = (now - v.t) / 86_400_000;
    if (ageDays < -1 || ageDays > CONSENT_MAX_AGE_DAYS) return null;
    if ([...SCOPE].some((group) => !(v.s as string).includes(group))) return null;
    return { analytics: v.a === 1 && HAS_ANALYTICS_TOOLS, ads: v.m === 1 && HAS_ADS_TOOLS };
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice): void {
  memoryRaw = JSON.stringify({ v: 1, a: choice.analytics ? 1 : 0, m: choice.ads ? 1 : 0, s: SCOPE, t: Date.now() });
  try {
    window.localStorage.setItem(STORAGE_KEY, memoryRaw);
  } catch {
    /* storage refused: the choice is kept for this page only */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // a choice made in another tab
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The footer's "Cookie settings" link. */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function subscribeConsentOpen(onOpen: () => void): () => void {
  window.addEventListener(OPEN_EVENT, onOpen);
  return () => window.removeEventListener(OPEN_EVENT, onOpen);
}

/* ───────────────────────── Loading the tools ───────────────────────── */

type Queued = (...args: unknown[]) => void;
type Fbq = Queued & { callMethod?: Queued; queue: unknown[][]; push: Queued; loaded: boolean; version: string; disablePushState: boolean };
type TrackingWindow = Window & {
  dataLayer?: unknown[];
  gtag?: Queued;
  clarity?: Queued & { q?: unknown[] };
  fbq?: Fbq;
  _fbq?: Fbq;
} & Record<`ga-disable-${string}`, boolean | undefined>;

const win = () => window as unknown as TrackingWindow;

const state = {
  gtagLoaded: false,
  gaConfigured: false,
  adsConfigured: false,
  clarityLoaded: false,
  pixelLoaded: false,
  /** Google Analytics may receive events right now. */
  gaOn: false,
  pixelOn: false,
  /** Set when the visitor heads to a private page: nothing more is sent from this page. */
  blocked: false,
  guardsArmed: false,
  lastGaPage: "",
  lastPixelPage: "",
  lastQuoteKey: "",
  checkoutSent: false,
};

/** True once any third-party script was added to this page. */
export function tagsLoaded(): boolean {
  return state.gtagLoaded || state.clarityLoaded || state.pixelLoaded;
}

function addScript(src: string): void {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

const gtag: Queued = function () {
  // Google's tag only understands the real `arguments` object, not an array.
  // eslint-disable-next-line prefer-rest-params
  (win().dataLayer ??= []).push(arguments);
};

/** Campaign parameters Google needs to know where a visit came from. Everything else after "?" is dropped. */
const KEEP_PARAMS = /^(utm_[a-z_]+|gclid|gbraid|wbraid|dclid|fbclid|msclkid|tab)$/;

/**
 * This page's address without the ride details: the ride builder keeps the ride in the
 * address (src/lib/shareLink.ts), including the name of a typed hotel or address.
 */
function cleanLocation(): string {
  const kept = new URLSearchParams();
  new URLSearchParams(window.location.search).forEach((value, key) => {
    if (KEEP_PARAMS.test(key)) kept.set(key, value.slice(0, 150));
  });
  const q = kept.toString();
  return `${window.location.origin}${window.location.pathname}${q ? `?${q}` : ""}`;
}

/** Where the visitor came from; a private page of ours (a trip link) is reported as just the site. */
function cleanReferrer(): string {
  try {
    if (!document.referrer) return "";
    const ref = new URL(document.referrer);
    if (ref.origin !== window.location.origin) return document.referrer;
    return isPrivatePath(ref.pathname) ? `${ref.origin}/` : `${ref.origin}${ref.pathname}`;
  } catch {
    return "";
  }
}

function loadGtag(id: string): void {
  const w = win();
  w.dataLayer ??= [];
  w.gtag = gtag;
  // Consent Mode v2: everything denied until the visitor's choice is applied just below.
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  gtag("js", new Date());
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  state.gtagLoaded = true;
}

function loadClarity(id: string): void {
  const w = win();
  if (!w.clarity) {
    const clarity = ((...args: unknown[]) => {
      (clarity.q ??= []).push(args);
    }) as Queued & { q?: unknown[] };
    w.clarity = clarity;
  }
  addScript(`https://www.clarity.ms/tag/${encodeURIComponent(id)}`);
  state.clarityLoaded = true;
}

function loadPixel(id: string): void {
  const w = win();
  if (!w.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }) as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    // We report page views ourselves, so a private address can never be sent.
    fbq.disablePushState = true;
    w.fbq = fbq;
    w._fbq = fbq;
  }
  addScript("https://connect.facebook.net/en_US/fbevents.js");
  w.fbq?.("init", id);
  state.pixelLoaded = true;
}

const ANALYTICS_COOKIES = /^(_ga|_ga_.+|_gid|_gat.*|_clck|_clsk)$/;
const ADS_COOKIES = /^(_gcl_.+|_gac_.+|_fbp|_fbc)$/;

/** Delete this site's own cookies set by the tools. Cookies on Google's or Microsoft's own domains are out of our reach. */
function clearCookies(names: RegExp): void {
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = ["", host];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`.${parts.slice(i).join(".")}`);
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (!name || !names.test(name)) continue;
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
    }
  }
}

/** Stop everything on this page for good (the visitor is heading to a private page). */
export function blockTracking(): void {
  state.blocked = true;
  state.gaOn = false;
  state.pixelOn = false;
  const w = win();
  if (GA_ID) w[`ga-disable-${GA_ID}`] = true;
  if (state.clarityLoaded) w.clarity?.("stop");
}

function isPrivateUrl(url: string | URL): boolean {
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin && isPrivatePath(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Set up before the first script is added, so these run before the tools' own listeners:
 * - going to a private page (a link, the browser's back button, or the app changing the
 *   address) switches the tools off first, so that address is never reported;
 * - WhatsApp, app store and language clicks are counted by type only. A WhatsApp link
 *   carries the message text (it can include the traveller's name), so the click is hidden
 *   from Google's own "outbound click" tracking, which would report the whole link.
 */
function armGuards(): void {
  if (state.guardsArmed) return;
  state.guardsArmed = true;

  window.addEventListener("popstate", () => {
    if (isPrivatePath(window.location.pathname)) blockTracking();
  });

  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];
    window.history[method] = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
      if (url != null && isPrivateUrl(url)) blockTracking();
      return original.call(this, data, unused, url);
    };
  }

  window.addEventListener(
    "click",
    (e) => {
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin === window.location.origin) {
        const plainClick = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && link.target !== "_blank";
        if (isPrivatePath(url.pathname)) {
          if (plainClick) blockTracking();
        } else if (link.dataset.analytics === "language") {
          send("click", { link_type: "language", language: link.hreflang === "es" ? "es" : "en" });
        }
        return;
      }
      if (url.hostname === "wa.me" || url.hostname === "api.whatsapp.com") {
        send("click", { link_type: "whatsapp" });
        if (state.gaOn) e.stopImmediatePropagation(); // the link still opens; only later listeners miss it
      } else if (url.hostname === "apps.apple.com" || url.hostname === "play.google.com") {
        send("click", { link_type: "app_store", store: url.hostname === "apps.apple.com" ? "apple" : "google" });
      }
    },
    true,
  );
}

/**
 * Make the page match the visitor's choice: load what was accepted, switch off and clear
 * what was not. Safe to call again and again. `null` = no choice yet = nothing allowed.
 */
export function applyConsent(choice: ConsentChoice | null): void {
  if (typeof window === "undefined" || state.blocked || isPrivatePath(window.location.pathname)) return;
  const analytics = Boolean(choice?.analytics);
  const ads = Boolean(choice?.ads);
  const useGa = analytics && GA_ID !== null;
  const useAds = ads && GOOGLE_ADS_ID !== null;
  const useClarity = analytics && CLARITY_ID !== null;
  const usePixel = ads && META_PIXEL_ID !== null;
  const w = win();

  if (useGa || useAds || useClarity || usePixel) armGuards();

  // Google Analytics and Google Ads share one script.
  if ((useGa || useAds) && !state.gtagLoaded) loadGtag((useGa ? GA_ID : GOOGLE_ADS_ID) as string);
  if (state.gtagLoaded) {
    gtag("consent", "update", {
      analytics_storage: analytics ? "granted" : "denied",
      ad_storage: ads ? "granted" : "denied",
      ad_user_data: ads ? "granted" : "denied",
      ad_personalization: ads ? "granted" : "denied",
    });
    if (GA_ID) w[`ga-disable-${GA_ID}`] = !useGa;
    if ((useGa && !state.gaConfigured) || (useAds && !state.adsConfigured)) {
      gtag("set", { page_location: cleanLocation(), page_referrer: cleanReferrer() });
    }
    if (useGa && !state.gaConfigured) {
      // Page views are sent by trackPageView() with a cleaned address, never automatically.
      gtag("config", GA_ID, { send_page_view: false });
      state.gaConfigured = true;
    }
    if (useAds && !state.adsConfigured) {
      gtag("config", GOOGLE_ADS_ID, { allow_enhanced_conversions: false });
      state.adsConfigured = true;
    }
  }
  state.gaOn = useGa;
  if (!useGa) state.lastGaPage = "";

  if (useClarity) {
    if (!state.clarityLoaded) loadClarity(CLARITY_ID as string);
    w.clarity?.("consent");
  } else if (state.clarityLoaded) {
    w.clarity?.("consent", false);
    w.clarity?.("stop"); // recording starts again on the next page if the visitor accepts again
  }

  if (usePixel) {
    if (!state.pixelLoaded) loadPixel(META_PIXEL_ID as string);
    w.fbq?.("consent", "grant");
  } else if (state.pixelLoaded) {
    w.fbq?.("consent", "revoke");
  }
  state.pixelOn = usePixel;
  if (!usePixel) state.lastPixelPage = "";

  if (!analytics) clearCookies(ANALYTICS_COOKIES);
  if (!ads) clearCookies(ADS_COOKIES);
}

/* ───────────────────────── Events ───────────────────────── */

function send(name: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined" || !state.gaOn || state.blocked || !GA_ID) return;
  if (isPrivatePath(window.location.pathname)) return;
  gtag("event", name, { ...params, send_to: GA_ID });
}

/** One page view per public page, with the address cleaned (no ride details, no typed places). */
export function trackPageView(): void {
  if (typeof window === "undefined" || state.blocked || isPrivatePath(window.location.pathname)) return;
  const path = window.location.pathname;
  if (state.gaOn && state.lastGaPage !== path) {
    const page_location = cleanLocation();
    const page_referrer = state.lastGaPage ? `${window.location.origin}${state.lastGaPage}` : cleanReferrer();
    state.lastGaPage = path;
    gtag("set", { page_location, page_referrer });
    send("page_view", { page_location, page_referrer, page_title: document.title });
  }
  if (state.pixelOn && state.lastPixelPage !== path) {
    state.lastPixelPage = path;
    win().fbq?.("track", "PageView");
  }
}

const usd = (cents: number) => Math.round(cents) / 100;

/** One of our towns by its code (e.g. "SJO", "ManuelAntonio"), or "custom" for a typed hotel or address. */
export type RouteEnd = string;

interface GaItem {
  item_id: string;
  item_category: CartItem["kind"];
  item_variant?: string;
  price: number;
  quantity: 1;
}

/** A trip item as Google Analytics sees it: codes and the price, never its title, notes or typed places. */
function gaItem(item: CartItem): GaItem {
  const s = item.spec;
  const base = { item_category: item.kind, price: usd(item.totalCents), quantity: 1 as const };
  if (s?.kind === "transfer") {
    const from = s.originPlace ? "custom" : s.origin;
    const to = s.destinationPlace ? "custom" : s.destination;
    return { ...base, item_id: `transfer:${from}>${to}`, item_variant: s.pricing === "bid" ? "bid" : s.vehicleId };
  }
  if (s?.kind === "day_tour") return { ...base, item_id: `tour:${s.tourId}` };
  if (s?.kind === "expedition") return { ...base, item_id: `expedition:${s.expeditionId}`, item_variant: s.tierId };
  return { ...base, item_id: item.kind };
}

function pricingOf(items: CartItem[]): "fixed" | "bid" | "mixed" {
  const bids = items.filter((i) => i.spec?.kind === "transfer" && i.spec.pricing === "bid").length;
  return bids === 0 ? "fixed" : bids === items.length ? "bid" : "mixed";
}

/** view_item: the ride builder shows prices for a route. Sent once per route, not on every change. */
export function trackQuoteView(q: { from: RouteEnd; to: RouteEnd; vehicleCount: number; fromCents: number }): void {
  const key = `${q.from}>${q.to}`;
  if (state.lastQuoteKey === key || !state.gaOn) return;
  state.lastQuoteKey = key;
  send("view_item", {
    currency: "USD",
    value: usd(q.fromCents),
    route_from: q.from,
    route_to: q.to,
    vehicle_count: q.vehicleCount,
    items: [{ item_id: `transfer:${key}`, item_category: "transfer", price: usd(q.fromCents), quantity: 1 }],
  });
}

/** select_item: a vehicle class is chosen in the ride builder. */
export function trackVehicleSelect(v: { from: RouteEnd; to: RouteEnd; vehicleId: string; priceCents: number }): void {
  send("select_item", {
    item_list_id: "vehicle_classes",
    route_from: v.from,
    route_to: v.to,
    items: [
      {
        item_id: `transfer:${v.from}>${v.to}`,
        item_category: "transfer",
        item_variant: v.vehicleId,
        price: usd(v.priceCents),
        quantity: 1,
      },
    ],
  });
}

/** add_to_cart: a ride, day tour or multi-day trip is added to "Your trip". */
export function trackAddToCart(item: CartItem): void {
  send("add_to_cart", {
    currency: "USD",
    value: usd(item.totalCents),
    pricing: pricingOf([item]),
    items: [gaItem(item)],
  });
}

/** begin_checkout: the traveller opens the trip to review it, or starts filling in their details. Once per trip. */
export function trackBeginCheckout(items: CartItem[], totalCents: number, mode: PaymentMode): void {
  if (state.checkoutSent || items.length === 0 || !state.gaOn) return;
  state.checkoutSent = true;
  send("begin_checkout", {
    currency: "USD",
    value: usd(totalCents),
    payment_mode: mode,
    pricing: pricingOf(items),
    item_count: items.length,
    items: items.map(gaItem),
  });
}

/** generate_lead: the trip request was saved. Nothing is charged at this point, so it is a lead, not a purchase. */
export function trackLead(items: CartItem[], totalCents: number, mode: PaymentMode): void {
  state.checkoutSent = false;
  send("generate_lead", {
    currency: "USD",
    value: usd(totalCents),
    payment_mode: mode,
    pricing: pricingOf(items),
    item_count: items.length,
    items: items.map(gaItem),
  });
}
