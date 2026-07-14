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
  band: Story["score"]["band"];
  total: number;
  sources: { id: string; name: string }[];
  discussionCount: number;
  radarScore: number;
  latestPublishedAt: string;
}

export function toFeedStory(story: Story): FeedStory {
  return {
    id: story.id,
    headline: story.headline,
    summary: story.summary,
    region: story.region,
    category: story.category,
    band: story.score.band,
    total: story.score.total,
    sources: story.articles.map((a) => ({ id: a.sourceId, name: a.sourceName })),
    discussionCount: story.discussions.length,
    radarScore: story.radarScore,
    latestPublishedAt: story.latestPublishedAt,
  };
}
