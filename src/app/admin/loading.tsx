/** Shown while an admin page loads (the side menu is already there). */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Cargando… / Loading…</span>
      <div aria-hidden className="h-8 w-56 animate-pulse rounded-lg bg-[#E3E8E5]" />
      <div aria-hidden className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-[#E3E8E5] bg-white" />
        ))}
      </div>
      <div aria-hidden className="h-72 animate-pulse rounded-2xl border border-[#E3E8E5] bg-white" />
      <p className="text-sm font-semibold text-[#5F6F67]">Cargando… / Loading…</p>
    </div>
  );
}
