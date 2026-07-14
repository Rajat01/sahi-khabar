import type { RawItem, SourceConfig } from "../../lib/types";

interface HnHit {
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  created_at: string;
  objectID: string;
}

/**
 * Hacker News via the Algolia API (free, no auth).
 * Front page + recent high-score stories that link out to external sites.
 */
export async function fetchHn(source: SourceConfig): Promise<RawItem[]> {
  const endpoints = [
    "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30",
    "https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>100&hitsPerPage=30",
  ];
  const seen = new Set<string>();
  const items: RawItem[] = [];

  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`hn algolia: HTTP ${res.status}`);
    const json = (await res.json()) as { hits?: HnHit[] };
    for (const hit of json.hits ?? []) {
      if (!hit.url || !hit.title || seen.has(hit.objectID)) continue;
      // project launches / self-promotion aren't news
      if (/^(Show|Ask|Launch|Tell) HN/i.test(hit.title)) continue;
      seen.add(hit.objectID);
      items.push({
        sourceId: source.id,
        title: hit.title.trim(),
        url: hit.url,
        publishedAt: hit.created_at,
        engagement: {
          score: hit.points ?? 0,
          comments: hit.num_comments ?? 0,
          discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        },
      });
    }
  }
  return items;
}
