import { SITE_URL } from "./site";

/**
 * Generating a unique share image for every story (11k+ and growing) would
 * add 20+ minutes to the build — most of that cost buys nothing, since a
 * share image only matters while a story is actually being shared, which is
 * almost always shortly after it breaks. So only "recent" stories/sagas get
 * a custom image; everything else falls back to one shared default.
 */
export const OG_IMAGE_WINDOW_MS = 24 * 3600_000;

export function hasCustomOgImage(latestPublishedAt: string, generatedAt: string): boolean {
  return Date.parse(generatedAt) - Date.parse(latestPublishedAt) <= OG_IMAGE_WINDOW_MS;
}

export function ogImageUrl(
  kind: "story" | "saga",
  id: string,
  latestPublishedAt: string,
  generatedAt: string,
): string {
  return hasCustomOgImage(latestPublishedAt, generatedAt)
    ? `${SITE_URL}/og/${kind}/${id}.png`
    : `${SITE_URL}/og/default.png`;
}
