import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";
import type { Dataset, Story } from "../lib/types";
import { hasCustomOgImage } from "../lib/og";
import { SITE_TAGLINE } from "../lib/site";

const DATA_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "stories.json");
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "og");
const SIZE = { width: 1200, height: 630 };

const BAND_COLOR: Record<Story["score"]["band"], string> = {
  high: "#0ca30c",
  medium: "#fab219",
  low: "#ec835a",
  unverified: "#898781",
};
const BAND_LABEL: Record<Story["score"]["band"], string> = {
  high: "Widely reported",
  medium: "Partially corroborated",
  low: "Limited reporting",
  unverified: "Not independently corroborated",
};

function wordmark() {
  return {
    type: "div",
    props: {
      style: { display: "flex", alignItems: "baseline", fontSize: 40, fontWeight: 700, color: "#fafafa" },
      children: [
        "KhabarCheck",
        {
          type: "div",
          props: {
            style: { marginLeft: 12, width: 10, height: 10, borderRadius: 999, background: "#e8b931" },
          },
        },
      ],
    },
  };
}

function storyCard(headline: string, band: Story["score"]["band"], total: number, outlets: number) {
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "70px",
        background: "#101014",
      },
      children: [
        wordmark(),
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.25,
              color: "#fafafa",
              letterSpacing: "-0.02em",
              // Satori has no line-clamp; cap length upstream instead.
            },
            children: headline,
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", fontSize: 30, color: "#d4d4d8" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: BAND_COLOR[band],
                    marginRight: 16,
                  },
                },
              },
              {
                type: "div",
                props: {
                  children: `${BAND_LABEL[band]}${band !== "unverified" ? ` · ${total}/100` : ""} · ${outlets} outlet${outlets === 1 ? "" : "s"}`,
                },
              },
            ],
          },
        },
      ],
    },
  };
}

function defaultCard() {
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#101014",
      },
      children: [
        wordmark(),
        {
          type: "div",
          props: {
            style: { marginTop: 28, fontSize: 32, fontWeight: 400, color: "#a1a1aa" },
            children: `${SITE_TAGLINE}. Every story scored, every source shown.`,
          },
        },
      ],
    },
  };
}

// Satori has no CSS line-clamp/ellipsis — cap the headline length upstream
// instead of letting long ones overflow the fixed 630px card.
function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

// The embedded font (and the dynamic Google Fonts fallback, which 400s on
// this glyph even with network access) has no ₹ — renders as a broken box.
// Common enough in Indian financial/crime headlines to swap out rather than
// ship broken glyphs on real share cards.
function sanitizeForOg(text: string): string {
  return text.replace(/₹\s*/g, "Rs ");
}

async function renderTo(path: string, node: unknown, size: { width: number; height: number } = SIZE) {
  const img = new ImageResponse(node as never, size);
  const buf = Buffer.from(await img.arrayBuffer());
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

function logoCard() {
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "24px 32px",
        background: "#101014",
      },
      children: wordmark(),
    },
  };
}

async function main() {
  const start = Date.now();
  let dataset: Dataset;
  try {
    dataset = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Dataset;
  } catch {
    console.warn("[og-images] no dataset yet, skipping");
    return;
  }

  // Fallback first: even if generation fails partway through, the default
  // image (which every non-recent story's metadata points to) still exists.
  await renderTo(join(OUT_DIR, "default.png"), defaultCard());
  // NewsArticle structured data wants publisher.logo — generated once here
  // since there's no static logo asset in the repo yet.
  await renderTo(join(OUT_DIR, "logo.png"), logoCard(), { width: 512, height: 128 });

  let storyCount = 0;
  for (const story of dataset.stories) {
    if (!hasCustomOgImage(story.latestPublishedAt, dataset.generatedAt)) continue;
    const outlets = new Set(story.articles.map((a) => a.sourceName)).size;
    try {
      await renderTo(
        join(OUT_DIR, "story", `${story.id}.png`),
        storyCard(truncate(sanitizeForOg(story.headline), 140), story.score.band, story.score.total, outlets),
      );
      storyCount++;
    } catch (err) {
      console.warn(`[og-images] failed for story ${story.id}: ${err}`);
    }
  }

  let sagaCount = 0;
  for (const saga of dataset.sagas ?? []) {
    const latest = dataset.stories.find((s) => s.id === saga.storyIds[0]);
    if (!latest) continue;
    const outlets = new Set(latest.articles.map((a) => a.sourceName)).size;
    try {
      await renderTo(
        join(OUT_DIR, "saga", `${saga.id}.png`),
        storyCard(truncate(sanitizeForOg(saga.title), 140), latest.score.band, latest.score.total, outlets),
      );
      sagaCount++;
    } catch (err) {
      console.warn(`[og-images] failed for saga ${saga.id}: ${err}`);
    }
  }

  console.log(
    `[og-images] ${storyCount} story + ${sagaCount} saga image(s) in ${((Date.now() - start) / 1000).toFixed(1)}s`,
  );
}

main().catch((err) => {
  // Non-fatal: stories fall back to the shared default image if this fails.
  console.error("[og-images]", err);
});
