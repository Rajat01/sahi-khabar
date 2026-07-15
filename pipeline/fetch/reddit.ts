import Parser from "rss-parser";
import type { RawItem, SourceConfig } from "../../lib/types";

/**
 * Reddit's unauthenticated JSON API now returns 403 across the board, so:
 *  - Default path: the still-public Atom feeds (r/<sub>/top/.rss). These give
 *    us the top posts of the day but no vote counts.
 *  - Upgrade path: if REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET are set (free
 *    "script" app from https://www.reddit.com/prefs/apps), use OAuth and get
 *    real scores and comment counts.
 */
const USER_AGENT = "web:khabarcheck:v0.1 (fact-based news aggregator)";

const SKIP_DOMAINS = [
  "reddit.com",
  "redd.it",
  "redditmedia.com",
  "imgur.com",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "streamable.com",
];

function isNewsLink(url: string): boolean {
  return /^https?:\/\//.test(url) && !SKIP_DOMAINS.some((d) => url.includes(d));
}

// Reddit rate-limits parallel unauthenticated requests hard — run all reddit
// fetches through one queue with a pause between them.
let queue: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function fetchReddit(source: SourceConfig): Promise<RawItem[]> {
  const task = queue.then(async () => {
    const useOauth = process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET;
    // Unauthenticated RSS is rate-limited over a multi-minute window; retry
    // 429s with a growing backoff instead of giving up.
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const items = useOauth ? await fetchViaOauth(source) : await fetchViaRss(source);
        await sleep(8000);
        return items;
      } catch (err) {
        lastError = err;
        if (!/429/.test(String(err))) break;
        await sleep(20000 * (attempt + 1));
      }
    }
    throw lastError;
  });
  queue = task.catch(() => undefined);
  return task;
}

// ---- RSS path (no auth, no vote counts) ----

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": USER_AGENT },
});

async function fetchViaRss(source: SourceConfig): Promise<RawItem[]> {
  // rss-parser's timeout is inactivity-based; race it against a hard cap so a
  // trickling response can't wedge the whole queue. A stall is almost always
  // rate-limiting, so the message includes "429" to trigger the retry backoff.
  const hardCap = new Promise<never>((_, reject) => {
    const t = setTimeout(
      () => reject(new Error("hard 30s timeout (treating as 429)")),
      30_000,
    );
    t.unref();
  });
  const feed = await Promise.race([
    parser.parseURL(`https://www.reddit.com/r/${source.url}/top/.rss?t=day&limit=40`),
    hardCap,
  ]);
  const items: RawItem[] = [];
  for (const entry of feed.items ?? []) {
    const title = entry.title?.trim();
    const discussionUrl = entry.link;
    if (!title || !discussionUrl) continue;
    // Link posts embed the external URL as <a href="...">[link]</a> in content
    const linkMatch = (entry.content ?? "").match(
      /<a href="([^"]+)">\s*\[link\]/,
    );
    const externalUrl = linkMatch?.[1]?.replace(/&amp;/g, "&");
    if (!externalUrl || !isNewsLink(externalUrl)) continue; // self/image/video post
    const publishedAt = entry.isoDate ?? new Date().toISOString();
    items.push({
      sourceId: source.id,
      title,
      url: externalUrl,
      publishedAt,
      engagement: { discussionUrl }, // no counts available over RSS
    });
  }
  return items;
}

// ---- OAuth path (real scores) ----

let oauthToken: { token: string; expiresAt: number } | null = null;

async function getOauthToken(): Promise<string> {
  if (oauthToken && oauthToken.expiresAt > Date.now() + 60_000) {
    return oauthToken.token;
  }
  const basic = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`reddit oauth: HTTP ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  oauthToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return oauthToken.token;
}

interface RedditPost {
  data: {
    title: string;
    url: string;
    permalink: string;
    score: number;
    num_comments: number;
    created_utc: number;
    is_self: boolean;
    stickied: boolean;
    over_18: boolean;
  };
}

async function fetchViaOauth(source: SourceConfig): Promise<RawItem[]> {
  const token = await getOauthToken();
  const res = await fetch(
    `https://oauth.reddit.com/r/${source.url}/top?t=day&limit=50&raw_json=1`,
    {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) throw new Error(`reddit r/${source.url}: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { children?: RedditPost[] } };

  const items: RawItem[] = [];
  for (const post of json.data?.children ?? []) {
    const d = post.data;
    if (!d || d.is_self || d.stickied || d.over_18) continue;
    if (!d.url || !isNewsLink(d.url)) continue;
    if (d.score < 50) continue; // only meaningfully-engaged posts
    items.push({
      sourceId: source.id,
      title: d.title.trim(),
      url: d.url,
      publishedAt: new Date(d.created_utc * 1000).toISOString(),
      engagement: {
        score: d.score,
        comments: d.num_comments,
        discussionUrl: `https://www.reddit.com${d.permalink}`,
      },
    });
  }
  return items;
}
