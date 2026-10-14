import Link from "next/link";

/** Header for the driver area: application and trips. */
export function DriverHeader() {
  return (
    <header className="bg-emerald-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="font-extrabold text-lg">
            PuraVidaWay <span className="text-amber-400">Drivers</span>
          </Link>
          <nav aria-label="Driver" className="flex gap-1 text-sm font-bold">
            <Link href="/driver" className="px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60">
              Profile &amp; documents
            </Link>
            <Link href="/driver/trips" className="px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60">
              Your trips
            </Link>
          </nav>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="min-h-10 px-3 rounded-lg border border-emerald-700 text-sm text-emerald-100">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
