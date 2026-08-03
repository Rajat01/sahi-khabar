import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";

/**
 * One-off generator for static app icons (favicon, PWA manifest icons).
 * Unlike pipeline/gen-og-images.ts these don't depend on the dataset, so
 * they're committed as regular static assets rather than regenerated every
 * CI run — re-run manually if the brand mark ever changes.
 */
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

function monogram(size: number) {
  const dot = Math.round(size * 0.11);
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#101014",
        position: "relative",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: size * 0.62,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: "-0.02em",
            },
            children: "K",
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              width: dot,
              height: dot,
              borderRadius: 999,
              background: "#e8b931",
              right: size * 0.24,
              top: size * 0.26,
            },
          },
        },
      ],
    },
  };
}

async function gen(size: number, name: string) {
  const img = new ImageResponse(monogram(size) as never, { width: size, height: size });
  const buf = Buffer.from(await img.arrayBuffer());
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), buf);
  console.log(`[icons] wrote ${name} (${size}x${size})`);
}

async function main() {
  await gen(512, "icon-512.png");
  await gen(192, "icon-192.png");
  await gen(180, "apple-icon.png");
  await gen(32, "favicon-32.png");
}

main();
