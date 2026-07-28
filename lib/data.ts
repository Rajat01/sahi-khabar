import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { explainRank, rankStories } from "./rank";
import type { Dataset, Story } from "./types";

const DATA_PATH = join(process.cwd(), "data", "stories.json");

// generateStaticParams/generateMetadata/the page component each call
// loadDataset() independently for every one of the 11k+ story/saga pages —
// keyed on mtime so a fresh `pnpm ingest` (dev mode) still invalidates it.
let cache: { mtimeMs: number; dataset: Dataset; byId: Map<string, Story> } | null = null;

function getCache() {
  const mtimeMs = statSync(DATA_PATH).mtimeMs;
  if (cache && cache.mtimeMs === mtimeMs) return cache;
  const dataset = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Dataset;
  const byId = new Map(dataset.stories.map((s) => [s.id, s]));
  cache = { mtimeMs, dataset, byId };
  return cache;
}

/**
 * The dataset is baked in at build time (static export). Dev mode re-reads on
 * each request, so a fresh `pnpm ingest` shows up on reload.
 */
export function loadDataset(): Dataset {
  return getCache().dataset;
}

/** O(1) story lookup instead of scanning the full array on every call. */
export function getStoryById(id: string): Story | undefined {
  return getCache().byId.get(id);
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
  /** Independent reporting origins (ownership/wire-copy/citation deduped). */
  origins: number;
  /** Official/primary-source count — separate from origins; see score.ts. */
  officialCount: number;
  /** One synthesized "what remains uncertain" note, when there's a real gap to name. */
  uncertainty?: string;
  sagaId?: string;
  /** Set only on the one card that stands in for a developing-story hub. */
  sagaTitle?: string;
  sagaCount?: number;
  /** Plain-language ranking explanation — only set on the home feed. */
  rankReason?: string;
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

/**
 * The fourth of the "four questions" a card should answer at a glance: what
 * remains uncertain. Synthesized from score data we already compute — never
 * a new claim, just naming the specific gap driving the score down. Picks
 * the single most relevant gap rather than listing every one, to stay
 * skimmable in a list of hundreds of cards.
 */
function uncertaintyNote(story: Story): string | undefined {
  if ((story.score.origins ?? 0) === 0) {
    return "Only an official statement confirms this so far — no independent reporting yet.";
  }
  if (story.score.flags.length > 0) {
    return `Headline flagged: ${story.score.flags.join(", ")}.`;
  }
  if ((story.score.origins ?? 0) === 1) {
    return "Reported by only one independent outlet so far.";
  }
  // Deliberately no "not linked to an official document" branch: with PIB's
  // feed currently empty, primarySource is ~0% across the whole dataset, so
  // that note would be true on nearly every card — accurate but no longer a
  // signal specific to THIS story. Revisit once PIB (or another primary
  // source) actually contributes articles again.
  return undefined;
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
    origins: story.score.origins ?? 0,
    officialCount: story.coverage.official,
    uncertainty: uncertaintyNote(story),
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
      out.push({ ...toFeedStory(story), rankReason: explainRank(story, nowIso) });
      continue;
    }
    if (emitted.has(story.sagaId)) continue;
    emitted.add(story.sagaId);
    const saga = sagaById.get(story.sagaId);
    if (!saga) {
      out.push({ ...toFeedStory(story), rankReason: explainRank(story, nowIso) });
      continue;
    }
    const latest = storyById.get(saga.storyIds[0]) ?? story;
    out.push({
      ...toFeedStory(latest),
      sagaId: saga.id,
      sagaTitle: saga.title,
      sagaCount: saga.storyIds.length,
      rankReason: explainRank(latest, nowIso),
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
