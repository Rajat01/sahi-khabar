import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "../config/sources";
import type { Dataset, RawItem, Story } from "../lib/types";
import { clusterItems } from "./cluster";
import { fetchHn } from "./fetch/hn";
import { fetchReddit } from "./fetch/reddit";
import { fetchRss } from "./fetch/rss";
import { dedupe } from "./normalize";
import { scoreClusters } from "./score";

const DATA_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "stories.json");
const MAX_AGE_DAYS = 7;

async function main() {
  console.log(`[ingest] ${SOURCES.length} sources`);

  // 1. Fetch everything in parallel; a broken feed never sinks the run.
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      switch (source.type) {
        case "rss":
          return fetchRss(source);
        case "reddit":
          return fetchReddit(source);
        case "hn":
          return fetchHn(source);
      }
    }),
  );

  const items: RawItem[] = [];
  const sourceStatus: Dataset["sourceStatus"] = [];
  results.forEach((result, i) => {
    const source = SOURCES[i];
    if (result.status === "fulfilled") {
      items.push(...result.value);
      sourceStatus.push({ sourceId: source.id, ok: true, items: result.value.length });
      console.log(`  ok   ${source.id}: ${result.value.length} items`);
    } else {
      sourceStatus.push({ sourceId: source.id, ok: false, items: 0, error: String(result.reason) });
      console.warn(`  FAIL ${source.id}: ${result.reason}`);
    }
  });

  // 2. Drop stale items, dedupe by canonical URL.
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400_000;
  const fresh = dedupe(items.filter((it) => Date.parse(it.publishedAt) > cutoff));
  console.log(`[ingest] ${items.length} fetched -> ${fresh.length} fresh+unique`);

  // 3. Cluster and score.
  const clusters = await clusterItems(fresh);
  console.log(`[ingest] ${clusters.length} story clusters`);
  const stories = await scoreClusters(clusters);

  // 4. Merge with the previous dataset: keep stable IDs and stories that have
  //    dropped out of feeds but are still < 7 days old.
  const previous = loadPrevious();
  const merged = mergeStories(stories, previous?.stories ?? [], cutoff);
  merged.sort((a, b) => Date.parse(b.latestPublishedAt) - Date.parse(a.latestPublishedAt));

  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    stories: merged,
    sourceStatus,
  };
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(dataset, null, 1));
  console.log(`[ingest] wrote ${merged.length} stories -> ${DATA_PATH}`);

  const failed = sourceStatus.filter((s) => !s.ok);
  if (failed.length > 0) {
    console.warn(`[ingest] ${failed.length} source(s) failed: ${failed.map((s) => s.sourceId).join(", ")}`);
  }
  if (failed.length === sourceStatus.length) {
    throw new Error("every source failed — aborting so the previous data is kept");
  }
}

function loadPrevious(): Dataset | null {
  try {
    return JSON.parse(readFileSync(DATA_PATH, "utf8")) as Dataset;
  } catch {
    return null;
  }
}

/**
 * New stories win; a new cluster that shares an article URL with an old story
 * inherits the old story's id and firstSeenAt so links stay stable across runs.
 */
function mergeStories(fresh: Story[], previous: Story[], cutoff: number): Story[] {
  const urlToOld = new Map<string, Story>();
  for (const old of previous) {
    for (const article of old.articles) urlToOld.set(article.url, old);
    for (const discussion of old.discussions) urlToOld.set(discussion.url, old);
  }

  const claimedOldIds = new Set<string>();
  for (const story of fresh) {
    const match =
      story.articles.map((a) => urlToOld.get(a.url)).find(Boolean) ??
      story.discussions.map((d) => urlToOld.get(d.url)).find(Boolean);
    if (match && !claimedOldIds.has(match.id)) {
      story.id = match.id;
      story.firstSeenAt = match.firstSeenAt < story.firstSeenAt ? match.firstSeenAt : story.firstSeenAt;
      claimedOldIds.add(match.id);
    }
  }

  const freshIds = new Set(fresh.map((s) => s.id));
  const kept = previous.filter(
    (old) =>
      !freshIds.has(old.id) &&
      !claimedOldIds.has(old.id) &&
      Date.parse(old.latestPublishedAt) > cutoff,
  );
  return [...fresh, ...kept];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
