import { ArrowRight, Clock, Compass, Luggage, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DriverStandards } from "@/components/trust/DriverStandards";
import { Reviews } from "@/components/trust/Reviews";
import { HUBS, routeMinutes } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalogSource";
import { applyMultiplier, formatDuration, formatUSD } from "@/lib/pricing";
import { builderHref, ROUTE_PAGES, routePage } from "@/lib/routePages";
import { GUARANTEES } from "@/lib/trust";

export function generateStaticParams() {
  return ROUTE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const page = routePage((await params).slug);
  if (!page) return {};
  return {
    title: `${page.title} | PuraVidaWay`,
    description: page.metaDescription,
  };
}

export default async function RouteLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const page = routePage((await params).slug);
  if (!page) notFound();

  const originName = HUBS.find((h) => h.id === page.origin)!.name;
  const destName = HUBS.find((h) => h.id === page.destination)!.name;
  const touches = (hubs?: string[]) =>
    !hubs || hubs.includes(page.origin) || hubs.includes(page.destination);
  const catalog = await getCatalog();
  const fitting = catalog.vehicles.filter((v) => touches(v.onlyForHubs));
  const vehicles = fitting.length ? fitting : catalog.vehicles;
  const cheapest = vehicles.reduce((a, b) => (b.baseRateCents < a.baseRateCents ? b : a));
  const defaultSeason = catalog.seasons.find((x) => x.isDefault);
  const fromCents = applyMultiplier(cheapest.baseRateCents, defaultSeason?.multiplierBps ?? 10000);
  const stops = catalog.stops.filter(
    (s) => s.corridors.includes(page.origin) || s.corridors.includes(page.destination),
  );
  const pct = (id: string) => {
    const season = catalog.seasons.find((x) => x.id === id);
    return season ? Math.round((season.multiplierBps - 10000) / 100) : 0;
  };
  const highPct = pct("high");
  const peakPct = pct("peak");
  const href = builderHref(page.origin, page.destination);
  const routeLabel = `${originName.split(" /")[0]} → ${destName}`;

  return (
    <div className="flex-1 bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-950 flex items-center justify-center text-amber-400">
              <Compass className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">PuraVidaWay</span>
          </Link>
          <Link
            href="/"
            className="min-h-11 inline-flex items-center px-4 rounded-xl bg-emerald-950 text-white text-sm font-bold"
          >
            Open trip builder
          </Link>
        </div>
      </header>

      <main>
      <nav aria-label="Breadcrumb" className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 text-sm text-slate-500">
        Costa Rica transfers › From {originName.split(" /")[0]} › {destName}
      </nav>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
            {page.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">{page.intro}</p>
          <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Fact icon={<Clock className="w-4 h-4" />} label="Drive time" value={`≈ ${formatDuration(routeMinutes(page.origin, page.destination))}`} />
            <Fact icon={<Users className="w-4 h-4" />} label="Private ride from" value={formatUSD(fromCents)} />
            <Fact icon={<Luggage className="w-4 h-4" />} label="Fits" value={cheapest.luggage} />
            <Fact icon={<MapPin className="w-4 h-4" />} label="Price is for" value="The vehicle" />
          </dl>
          <p className="mt-3 text-sm text-slate-500">
            {defaultSeason?.name ?? "Green season"} price, {cheapest.name}, up to {cheapest.maxPax} travelers.
            {highPct > 0 ? ` December to April adds ${highPct}%` : ""}
            {peakPct > 0 ? `; Christmas–New Year and Easter week add ${peakPct}%.` : highPct > 0 ? "." : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-emerald-950/5">
          <h2 className="text-lg font-extrabold text-slate-900">Plan this ride</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pick your date, travelers, vehicle and stops. You&apos;ll see the exact price before you book.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>Pickup: {originName}</li>
            <li>Drop-off: your hotel in {page.areaLabel}</li>
          </ul>
          <Link
            href={href}
            className="mt-5 min-h-12 flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950"
          >
            See price &amp; add stops <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <p className="mt-3 text-xs text-center text-slate-500">
            Opens the trip builder with this ride filled in.
          </p>
        </div>
      </section>

      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">{page.driveTitle}</h2>
            <p className="mt-3 leading-relaxed text-slate-600">{page.drive}</p>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Stops you can add</h2>
            <ul className="mt-4 space-y-3">
              {stops.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4"
                >
                  <span>
                    <span className="block font-bold text-slate-900">{s.name}</span>
                    <span className="text-sm text-slate-500">
                      {formatDuration(s.durationMin)} · {s.description}
                    </span>
                  </span>
                  <span className="font-extrabold text-emerald-700 whitespace-nowrap">
                    +{formatUSD(s.priceCents)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-500">Your driver waits with your bags locked in the vehicle.</p>
          </div>
        </div>
      </section>

      <Reviews route={routeLabel} />

      <DriverStandards />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {GUARANTEES.map((g) => (
            <div key={g.title}>
              <h3 className="font-extrabold text-slate-900">{g.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{g.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
        <h2 className="text-2xl font-extrabold text-slate-900">Questions travelers ask</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {page.faqs.map((f) => (
            <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-extrabold text-slate-900">{f.q}</h3>
              <p className="mt-1.5 text-slate-600 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-extrabold text-slate-900">Other rides</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {page.related.map((r) => (
            <Link
              key={r.label}
              href={builderHref(r.origin, r.destination)}
              className="min-h-11 inline-flex items-center px-4 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:border-emerald-500"
            >
              {r.label}
            </Link>
          ))}
        </div>
      </section>

      </main>

      <footer className="bg-emerald-950 text-emerald-200 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">PuraVidaWay · Costa Rica</div>
      </footer>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <span className="text-emerald-600" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-base font-extrabold text-slate-900">{value}</dd>
    </div>
  );
}
