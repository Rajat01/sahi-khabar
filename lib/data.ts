import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rankStories } from "./rank";
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
  /** Set only on the one card that stands in for a developing-story hub. */
  sagaTitle?: string;
  sagaCount?: number;
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

/**
 * Rank stories, then collapse each developing-story saga into ONE card so a
 * busy news cycle (14+ Wangchuk-protest developments) doesn't dominate the
 * feed. The card sits at the position its best-ranked development earned,
 * but shows the LATEST development's headline — readers get "what's new,"
 * not whichever fragment happened to rank highest. Individual developments
 * remain full stories with their own pages, scores, and place in filters —
 * nothing is hidden, only de-duplicated in this one list.
 */
export function collapseSagasForFeed(stories: Story[], nowIso: string, sagas: Dataset["sagas"]): FeedStory[] {
  const ranked = rankStories(stories, nowIso);
  const sagaById = new Map((sagas ?? []).map((s) => [s.id, s]));
  const storyById = new Map(stories.map((s) => [s.id, s]));
  const emitted = new Set<string>();
  const out: FeedStory[] = [];
  for (const story of ranked) {
    if (!story.sagaId) {
      out.push(toFeedStory(story));
      continue;
    }
    if (emitted.has(story.sagaId)) continue;
    emitted.add(story.sagaId);
    const saga = sagaById.get(story.sagaId);
    if (!saga) {
      out.push(toFeedStory(story));
      continue;
    }
    const latest = storyById.get(saga.storyIds[0]) ?? story;
    out.push({
      ...toFeedStory(latest),
      sagaId: saga.id,
      sagaTitle: saga.title,
      sagaCount: saga.storyIds.length,
    });
  }
  return out;
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
