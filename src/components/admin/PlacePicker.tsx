"use client";

import type { HubId } from "@/lib/catalog";
import { hubPlace, isHubPlace, type RidePlace } from "@/lib/places";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { PlaceInput } from "@/components/PlaceInput";
import { field } from "./ui";

/**
 * Pickup or drop-off: our towns as one-tap quick picks above the website's own place search
 * (PlaceInput: our towns, then hotels, docks and addresses from Google once 3+ letters are typed).
 */
export function PlacePicker({
  label,
  value,
  hubs,
  lang,
  onChange,
}: {
  label: string;
  value: RidePlace;
  hubs: { id: HubId; name: string }[];
  lang: TeamLang;
  onChange: (p: RidePlace) => void;
}) {
  const t = makeT(lang);
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold text-[#5F6F67]">
        {label} · {t("rápido:", "quick pick:")}
      </p>
      <div className="mb-2 mt-1 flex flex-wrap gap-1.5">
        {hubs.map((h) => {
          const on = isHubPlace(value) && value.hub === h.id;
          return (
            <button
              key={h.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(hubPlace(h.id))}
              className={`min-h-9 rounded-full border px-3 text-xs font-bold ${on ? "border-[#047857] bg-[#ECFDF5] text-[#065F46]" : "border-[#DCE3DF] bg-white text-[#33443C] hover:bg-[#F1F4F2]"}`}
            >
              {h.name}
            </button>
          );
        })}
      </div>
      <PlaceInput label={label} value={value} onChange={onChange} />
      {!isHubPlace(value) && (
        <p className={field.hint}>
          {value.address ?? value.label} · {t("precio por la ruta real de Google, igual que en el sitio", "priced by Google's real route, as on the website")}
        </p>
      )}
    </div>
  );
}

