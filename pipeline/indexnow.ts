import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL } from "../lib/site";
import type { Dataset } from "../lib/types";

/**
 * Notify IndexNow-participating search engines (Bing, Yandex, Seznam, Naver)
 * about fresh story URLs after each deploy. Free, keyless-account protocol:
 * the key only has to match the key file served from the site root.
 * Google does not use IndexNow — it discovers via sitemap.xml instead.
 */
const KEY = "2337bfdcdde518822c849ee742fb4bac";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRESH_WINDOW_MS = 3 * 60 * 60 * 1000; // stories first seen since last ~2h run

async function main() {
  const dataset = JSON.parse(
    readFileSync(join(ROOT, "data", "stories.json"), "utf-8"),
  ) as Dataset;

  const cutoff = Date.now() - FRESH_WINDOW_MS;
  const urlList = [
    `${SITE_URL}/`,
    ...dataset.stories
      .filter((s) => Date.parse(s.firstSeenAt) >= cutoff)
      .map((s) => `${SITE_URL}/story/${s.id}/`),
  ].slice(0, 500);

  if (urlList.length <= 1) {
    console.log("[indexnow] no fresh stories this run — skipping ping");
    return;
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITE_URL).host,
      key: KEY,
      keyLocation: `${SITE_URL}/${KEY}.txt`,
      urlList,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  console.log(`[indexnow] submitted ${urlList.length} urls -> HTTP ${res.status}`);
  if (!res.ok && res.status !== 202) {
    console.error(await res.text());
    process.exitCode = 1;
  }
}

main().catch((err) => {
  // Non-fatal by design: indexing pings should never fail the deploy job.
  console.error("[indexnow] failed:", err);
});
