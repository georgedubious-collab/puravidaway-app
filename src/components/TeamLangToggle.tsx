import { setTeamLang } from "@/lib/teamLangActions";
import type { TeamLang } from "@/lib/teamLang";

/** "ES | EN" switch in the admin and driver headers (works without JavaScript). */
export function TeamLangToggle({ lang }: { lang: TeamLang }) {
  return (
    <form action={setTeamLang} className="flex overflow-hidden rounded-lg border border-emerald-700 text-xs font-bold">
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="submit"
          name="lang"
          value={l}
          aria-pressed={lang === l}
          title={l === "es" ? "Español" : "English"}
          className={`min-h-10 px-3 ${
            lang === l ? "bg-amber-400 text-emerald-950" : "text-emerald-100 hover:bg-emerald-800/60"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </form>
  );
}
