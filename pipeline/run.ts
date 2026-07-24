import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "../config/sources";
import type { Dataset, RawItem, Story } from "../lib/types";
import { clusterItems } from "./cluster";
import { fetchHn } from "./fetch/hn";
import { fetchReddit } from "./fetch/reddit";
import { fetchRss } from "./fetch/rss";
import { decodeEntities, dedupe, isNonNews } from "./normalize";
import { saveRedirects } from "./redirects";
import { detectSagas } from "./sagas";
import { applyCoverage, applyRegion, categorizeAll, scoreClusters } from "./score";

const DATA_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "stories.json");
const MAX_AGE_DAYS = 7;
const RECLUSTER_WINDOW_MS = 48 * 3600_000;

/** Previous-dataset articles/discussions as raw items for re-clustering. */
function recycleRecent(previous: Dataset | null, windowMs: number): RawItem[] {
  if (!previous) return [];
  const cutoff = Date.now() - windowMs;
  const recycled: RawItem[] = [];
  for (const story of previous.stories) {
    if (Date.parse(story.latestPublishedAt) < cutoff) continue;
    for (const a of story.articles) {
      recycled.push({
        sourceId: a.sourceId,
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt,
        summary: a.summary,
      });
    }
    for (const d of story.discussions) {
      recycled.push({
        sourceId: d.platform === "hn" ? "hn" : redditSourceId(d.label),
        title: d.title,
        url: d.url,
        publishedAt: d.publishedAt,
        engagement: {
          score: d.score,
          comments: d.comments,
          discussionUrl: d.discussionUrl,
        },
      });
    }
  }
  return recycled;
}

function redditSourceId(label: string): string {
  return "r-" + label.replace(/^r\//, "");
}

/**
 * Hard wall-clock cap per source. Socket-level timeouts are inactivity-based
 * and a server that trickles bytes can hold a request open forever — observed
 * in the wild with Reddit's CDN. The timer is unref'd so it never keeps the
 * process alive itself.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => reject(new Error(`${label}: hard timeout after ${ms / 1000}s`)), ms);
      t.unref();
    }),
  ]);
}

async function main() {
  console.log(`[ingest] ${SOURCES.length} sources`);

  // 1. Fetch everything in parallel; a broken feed never sinks the run.
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      switch (source.type) {
        case "rss":
          return withTimeout(fetchRss(source), 90_000, source.id);
        case "reddit":
          // reddit fetches run serially with retry backoff behind one queue,
          // so the whole-queue budget has to be generous
          return withTimeout(fetchReddit(source), 480_000, source.id);
        case "hn":
          return withTimeout(fetchHn(source), 90_000, source.id);
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
  const previous = loadPrevious();
  // Outlets publish the same event hours apart, and fast-churning feeds drop
  // articles quickly — items fetched in different runs would otherwise never
  // meet in one clustering pool and the story stays fragmented forever. So
  // recent articles from the previous dataset re-enter clustering every run.
  const recycled = recycleRecent(previous, RECLUSTER_WINDOW_MS);
  const fresh = dedupe(
    [...items, ...recycled].filter(
      (it) => Date.parse(it.publishedAt) > cutoff && !isNonNews(it.title),
    ),
  );
  console.log(
    `[ingest] ${items.length} fetched + ${recycled.length} recycled -> ${fresh.length} fresh+unique`,
  );

  // 3. Cluster and score.
  const clusters = await clusterItems(fresh);
  console.log(`[ingest] ${clusters.length} story clusters`);
  const stories = await scoreClusters(clusters, previous?.stories ?? []);

  // 4. Merge with the previous dataset: keep stable IDs and stories that have
  //    dropped out of feeds but are still < 7 days old.
  const merged = mergeStories(stories, previous?.stories ?? [], cutoff);
  // Coverage/blindspot/category derive purely from content + config, so
  // recompute for carried-over stories too — old datasets heal immediately
  // when the rules improve.
  merged.forEach((story) => {
    // heal double-encoded HTML entities in previously stored text too
    story.headline = decodeEntities(story.headline);
    if (story.summary) story.summary = decodeEntities(story.summary);
    for (const a of story.articles) {
      a.title = decodeEntities(a.title);
      if (a.summary) a.summary = decodeEntities(a.summary);
    }
    for (const disc of story.discussions) disc.title = decodeEntities(disc.title);
    story.categories = categorizeAll(story.headline + " " + (story.summary ?? ""));
    story.category = story.categories[0];
    applyRegion(story);
    applyCoverage(story);
  });
  merged.sort((a, b) => Date.parse(b.latestPublishedAt) - Date.parse(a.latestPublishedAt));

  // Second-level grouping for the feed: developing-story hubs.
  merged.forEach((s) => { s.sagaId = undefined; });
  const sagas = detectSagas(merged);
  if (sagas.length > 0) {
    console.log(`[ingest] ${sagas.length} developing-story hub(s): ${sagas.slice(0, 3).map((s) => `${s.title} (${s.storyIds.length})`).join(", ")}`);
  }

  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    stories: merged,
    sagas,
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

  // An old id may already belong to a fresh cluster naturally (same anchor
  // URL); letting a second cluster claim it would put duplicate ids in the
  // dataset — which breaks React keys and corrupts client-side filtering.
  const naturalIds = new Set(fresh.map((s) => s.id));
  const claimedOldIds = new Set<string>();
  for (const story of fresh) {
    const match =
      story.articles.map((a) => urlToOld.get(a.url)).find(Boolean) ??
      story.discussions.map((d) => urlToOld.get(d.url)).find(Boolean);
    if (!match || claimedOldIds.has(match.id)) continue;
    if (naturalIds.has(match.id) && match.id !== story.id) continue;
    story.id = match.id;
    story.firstSeenAt = match.firstSeenAt < story.firstSeenAt ? match.firstSeenAt : story.firstSeenAt;
    claimedOldIds.add(match.id);
  }
  // Belt and braces: if duplicates slip through anyway, keep the richer story.
  const byId = new Map<string, Story>();
  for (const story of fresh) {
    const existing = byId.get(story.id);
    if (!existing || story.articles.length > existing.articles.length) {
      byId.set(story.id, story);
    }
  }
  const deduped = [...byId.values()];

  const freshIds = new Set(deduped.map((s) => s.id));
  // Re-clustering can absorb several old stories into one fresh one; an old
  // story whose URLs now live inside fresh stories is superseded, not lost.
  // Record where each absorbed id went so old links can 301 instead of 404.
  const urlToFreshId = new Map<string, string>();
  for (const s of deduped) {
    for (const a of s.articles) urlToFreshId.set(a.url, s.id);
    for (const d of s.discussions) urlToFreshId.set(d.url, s.id);
  }
  const redirects = new Map<string, string>();
  const kept = previous.filter((old) => {
    if (freshIds.has(old.id) || claimedOldIds.has(old.id)) return false;
    const target =
      old.articles.map((a) => urlToFreshId.get(a.url)).find(Boolean) ??
      old.discussions.map((d) => urlToFreshId.get(d.url)).find(Boolean);
    if (target) {
      redirects.set(old.id, target);
      return false;
    }
    // non-news (roundups, horoscopes, …) is filtered at ingestion now;
    // purge items already stored from before the rules existed
    if (isNonNews(old.headline)) return false;
    return Date.parse(old.latestPublishedAt) > cutoff;
  });
  saveRedirects(redirects);
  if (redirects.size > 0) {
    console.log(`[ingest] recorded ${redirects.size} story redirect(s) for absorbed ids`);
  }
  return [...deduped, ...kept];
}

main()
  .then(() => {
    // Lingering keep-alive sockets from feed fetches can hold the event loop
    // open indefinitely (and would hang the CI job) — exit explicitly.
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
