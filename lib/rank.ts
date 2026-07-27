import type { Story } from "./types";

/**
 * Feed ordering: importance-weighted recency instead of raw publish time, so a
 * major well-corroborated story doesn't sink under a stream of minor items.
 * Nothing is ever filtered out by this — it only orders. Weights are documented
 * openly on /about.
 */
export const CATEGORY_WEIGHT: Record<Story["category"], number> = {
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

/**
 * Plain-language version of the SAME inputs rankScore uses above, so "why am
 * I seeing this" is never a separate, driftable explanation — if the formula
 * changes, this changes with it. Purely descriptive: it states the inputs,
 * not a verdict on whether they add up to "high" or "low" (the reader can
 * see the story's position for themselves).
 */
export function explainRank(story: Story, nowIso: string): string {
  const ageHours = Math.max(0, (Date.parse(nowIso) - Date.parse(story.latestPublishedAt)) / 3600_000);
  const recency =
    ageHours < 1
      ? "published moments ago"
      : ageHours < 24
        ? `published ${Math.round(ageHours)}h ago`
        : `published ${Math.round(ageHours / 24)} day${Math.round(ageHours / 24) === 1 ? "" : "s"} ago`;

  const outlets = new Set(story.articles.map((a) => a.sourceName)).size;
  const corroboration =
    outlets >= 2
      ? `corroborated by ${outlets} outlets`
      : outlets === 1
        ? "reported by a single outlet so far"
        : "not yet reported by a tracked outlet";

  const weight = CATEGORY_WEIGHT[story.category] ?? 1.0;
  const category =
    weight < 0.8
      ? `filed under ${story.category}, a category ranked lower by default`
      : story.category !== "other"
        ? `concerns ${story.category}`
        : undefined;

  const bandNote =
    story.score.band === "unverified"
      ? "ranked slightly lower since it isn't independently corroborated yet"
      : undefined;

  const parts = [recency, corroboration, category, bandNote].filter((p): p is string => Boolean(p));
  return `Ranked here because it's ${parts.join(", ")}.`;
}
