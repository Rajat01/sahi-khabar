import Parser from "rss-parser";
import type { RawItem, SourceConfig } from "../../lib/types";
import { decodeEntities } from "../normalize";

const parser = new Parser({
  timeout: 15000,
  headers: {
    // Several outlets (PIB, HT) 403 anything that doesn't start with Mozilla/
    "User-Agent": "Mozilla/5.0 (compatible; khabarcheck/0.1; fact-based news reader)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

export async function fetchRss(source: SourceConfig): Promise<RawItem[]> {
  const feed = await parser.parseURL(source.url);
  const items: RawItem[] = [];
  for (const item of feed.items ?? []) {
    const title = item.title && decodeEntities(item.title.trim());
    const url = item.link?.trim();
    if (!title || !url) continue;
    const publishedAt = item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : undefined);
    if (!publishedAt || Number.isNaN(Date.parse(publishedAt))) continue;
    items.push({
      sourceId: source.id,
      title,
      url,
      publishedAt,
      summary: cleanSummary(decodeEntities(item.contentSnippet ?? item.summary ?? "") || undefined),
    });
  }
  return items;
}

function cleanSummary(text?: string): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > 300 ? cleaned.slice(0, 297) + "..." : cleaned;
}
