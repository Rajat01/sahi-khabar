import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Dataset, Story } from "./types";

/**
 * The dataset is baked in at build time (static export). Dev mode re-reads on
 * each request, so a fresh `pnpm ingest` shows up on reload.
 */
export function loadDataset(): Dataset {
  const path = join(process.cwd(), "data", "stories.json");
  return JSON.parse(readFileSync(path, "utf8")) as Dataset;
}

/** Slim shape embedded in the feed pages (keeps HTML payload small). */
export interface FeedStory {
  id: string;
  headline: string;
  summary?: string;
  region: Story["region"];
  category: Story["category"];
  categories: Story["categories"];
  band: Story["score"]["band"];
  total: number;
  sources: { id: string; name: string }[];
  discussionCount: number;
  radarScore: number;
  blindspot: boolean;
  /** Recently surfaced with a single outlet — early, expect the score to move. */
  developing: boolean;
  sagaId?: string;
  latestPublishedAt: string;
}

const DEVELOPING_WINDOW_MS = 2 * 3600_000;

export function isDeveloping(story: Story): boolean {
  const outlets = new Set(story.articles.map((a) => a.sourceName)).size;
  return (
    outlets === 1 &&
    Date.now() - Date.parse(story.firstSeenAt) < DEVELOPING_WINDOW_MS
  );
}

export function toFeedStory(story: Story): FeedStory {
  return {
    id: story.id,
    headline: story.headline,
    summary: story.summary,
    region: story.region,
    category: story.category,
    categories: story.categories ?? [story.category],
    band: story.score.band,
    total: story.score.total,
    sources: [
      ...new Map(
        story.articles.map((a) => [a.sourceName, { id: a.sourceId, name: a.sourceName }]),
      ).values(),
    ],
    discussionCount: story.discussions.length,
    radarScore: story.radarScore,
    blindspot: story.blindspot === "mainstream-blindspot",
    developing: isDeveloping(story),
    sagaId: story.sagaId,
    latestPublishedAt: story.latestPublishedAt,
  };
}

/** Slimmer still — the corpus the /check tool searches in the browser. */
export interface CheckStory {
  id: string;
  headline: string;
  summary?: string;
  band: Story["score"]["band"];
  total: number;
  outlets: string[];
  latestPublishedAt: string;
}

export function toCheckStory(story: Story): CheckStory {
  return {
    id: story.id,
    headline: story.headline,
    summary: story.summary,
    band: story.score.band,
    total: story.score.total,
    outlets: [...new Set(story.articles.map((a) => a.sourceName))],
    latestPublishedAt: story.latestPublishedAt,
  };
}
