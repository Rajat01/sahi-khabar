import { ImageResponse } from "next/og";
import { SITE_TAGLINE } from "../lib/site";

export const dynamic = "force-static";
export const alt = "KhabarCheck — fact-based news, with receipts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Branded share card, pre-rendered at build time (Latin text only —
 * the default embedded font has no Devanagari glyphs). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#101014",
          color: "#fafafa",
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          KhabarCheck
          <div
            style={{
              marginLeft: 24,
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#e8b931",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 38,
            fontWeight: 400,
            color: "#a1a1aa",
            letterSpacing: "0",
          }}
        >
          {`${SITE_TAGLINE}. Every story scored, every source shown.`}
        </div>
      </div>
    ),
    size,
  );
}
