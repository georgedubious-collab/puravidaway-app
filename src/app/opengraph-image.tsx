import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// Link-preview image for WhatsApp, Facebook, X etc. Uses the built-in font only.
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #022c22 0%, #064e3b 60%, #047857 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              background: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#022c22",
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, maxWidth: 960 }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ fontSize: 32, color: "#a7f3d0" }}>
            Door to door · Local partner drivers · Costa Rica
          </div>
        </div>

        <div style={{ display: "flex", height: 12, width: 220, borderRadius: 6, background: "#fbbf24" }} />
      </div>
    ),
    size,
  );
}
