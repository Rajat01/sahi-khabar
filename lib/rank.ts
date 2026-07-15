import type { Story } from "./types";

/**
 * Feed ordering: importance-weighted recency instead of raw publish time, so a
 * major well-corroborated story doesn't sink under a stream of minor items.
 * Nothing is ever filtered out by this — it only orders. Weights are documented
 * openly on /about.
 */
const CATEGORY_WEIGHT: Record<Story["category"], number> = {
  politics: 1.0,
  business: 0.9,
  science: 0.85,
  tech: 0.6,
  sports: 0.6,
  other: 1.0,
};

const RECENCY_HALF_LIFE_HOURS = 18;

export function rankScore(story: Story, nowMs: number): number {
  const ageHours = Math.max(0, (nowMs - Date.parse(story.latestPublishedAt)) / 3600_000);
  const recency = Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);

  const outlets = new Set(story.articles.map((a) => a.sourceName)).size;
  const corroboration = 1 + 0.4 * Math.log2(1 + outlets);

  // No region boost: the India/World tabs are the reader's lens, and the
  // default "All" ordering stays region-neutral by design.
  const category = CATEGORY_WEIGHT[story.category] ?? 1.0;
  // single low-tier-source stories stay visible, just below corroborated news
  const bandFactor = story.score.band === "unverified" ? 0.75 : 1.0;

  return recency * corroboration * category * bandFactor;
}

export function rankStories(stories: Story[], nowIso: string): Story[] {
  const now = Date.parse(nowIso);
  return [...stories].sort((a, b) => rankScore(b, now) - rankScore(a, now));
}
