"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/**
 * Something on an admin page failed to load (the side menu stays). Spanish first, English
 * below: the language cookie can't be read here. "Intentar de nuevo" reloads just this page.
 */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[admin] Page error", error.digest ?? "", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-6 max-w-xl rounded-2xl border border-[#FECACA] bg-white p-6 sm:p-8">
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#B91C1C]">Error</p>
      <h1 className="mt-2 text-2xl font-extrabold text-[#14231C]">No se pudo cargar esta página</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#33443C]">
        Puede ser la conexión o la base de datos. Intente de nuevo; si sigue pasando, recargue en un minuto. Nada de lo
        que ya estaba guardado se perdió.
      </p>
      <p lang="en" className="mt-3 text-sm leading-relaxed text-[#5F6F67]">
        This page didn&apos;t load. It may be the connection or the database. Try again; if it keeps happening, reload in
        a minute. Nothing already saved was lost.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-[#5F6F67]">
          Código / Code: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center rounded-xl bg-[#047857] px-5 text-sm font-extrabold text-white hover:bg-[#065F46]"
        >
          Intentar de nuevo / Try again
        </button>
        <a
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-xl border border-[#DCE3DF] bg-white px-4 text-sm font-bold text-[#14231C] hover:bg-[#F1F4F2]"
        >
          Ir al panel / Go to the dashboard
        </a>
      </div>
    </div>
  );
}
