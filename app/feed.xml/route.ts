import { loadDataset } from "../../lib/data";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../../lib/site";

export const dynamic = "force-static";

const MAX_ITEMS = 50;

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function GET() {
  const { stories, generatedAt } = loadDataset();
  const items = stories
    .filter((s) => s.articles.length > 0)
    .slice(0, MAX_ITEMS)
    .map((s) => {
      const outlets = [...new Set(s.articles.map((a) => a.sourceName))].join(", ");
      const desc = `${s.summary ?? s.headline} — reported by ${outlets}. Confidence: ${s.score.total}/100 (${s.score.band}).`;
      return `    <item>
      <title>${esc(s.headline)}</title>
      <link>${SITE_URL}/story/${s.id}/</link>
      <guid isPermaLink="true">${SITE_URL}/story/${s.id}/</guid>
      <pubDate>${new Date(s.latestPublishedAt).toUTCString()}</pubDate>
      <description>${esc(desc)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(SITE_DESCRIPTION)}</description>
    <language>en-in</language>
    <lastBuildDate>${new Date(generatedAt).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
