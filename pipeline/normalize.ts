import type { RawItem } from "../lib/types";

/** Strip tracking params, fragments, and trailing slashes so the same article
 *  fetched from RSS and linked from Reddit dedupes to one URL. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const params = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (/^(utm_|fbclid|gclid|ref|cmp|ito|smid|mc_)/i.test(k)) continue;
      params.set(k, v);
    }
    u.search = params.toString() ? `?${params.toString()}` : "";
    u.hash = "";
    u.hostname = u.hostname.replace(/^(www|m|amp)\./, "");
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^(www|m|amp)\./, "");
  } catch {
    return "";
  }
}

import { STOPWORDS, tokenize } from "../lib/text";

export { tokenize };

/** Capitalized words from the original title — a cheap proper-noun signal. */
export function properNouns(title: string): Set<string> {
  const nouns = new Set<string>();
  for (const word of title.split(/\s+/).slice(1)) {
    const m = word.match(/^[A-Z][a-zA-Z]{2,}/);
    if (m && !STOPWORDS.has(m[0].toLowerCase())) nouns.add(m[0].toLowerCase());
  }
  const first = title.split(/\s+/)[0]?.match(/^[A-Z]{2,}$/);
  if (first) nouns.add(first[0].toLowerCase());
  return nouns;
}

/** Dedupe by canonical URL; keep the item with engagement data when duplicated. */
/**
 * Roundup/digest items cover several unrelated events in one headline, which
 * makes them cluster "bridges": each event matches, and transitive merging
 * then welds unrelated stories together (observed: an "Evening news wrap"
 * fusing a court case with a party rebellion into one fake 9-outlet story).
 * They add no unique reporting, so drop them at ingestion.
 */
const ROUNDUP_PATTERN =
  /\b(news wrap|evening wrap|morning wrap|wrap-?up|news roundup|round-?up|daily briefing|morning briefing|evening briefing|news digest|top \d+ (news|stories|headlines)|headlines of the day|live updates|as it happened|key highlights|in brief)\b|^watch:|^in pics|^photos:/i;

/**
 * Recurring service content is not news reporting: horoscopes, puzzle
 * answers, lottery results. Anchored patterns on purpose — a news FEATURE
 * about astrology apps ("Beyond kundali matching & daily horoscopes: …")
 * must survive this filter; only the service items themselves get dropped.
 */
const SERVICE_PATTERN =
  /^(your )?(daily |weekly |monthly |today'?s? |love |career |chinese )?horoscopes?\b|\bhoroscopes? (today|for) \b|astrological predictions?|\bpanchang\b|\brashifal\b|tarot (card )?(reading|predictions?)|numerology predictions?|\b(wordle|quordle|connections|strands|sudoku) (hints?|answers?|today)|lottery (results?|sambad)|shillong teer/i;

export function isNonNews(title: string): boolean {
  return ROUNDUP_PATTERN.test(title) || SERVICE_PATTERN.test(title);
}

export function dedupe(items: RawItem[]): RawItem[] {
  const byUrl = new Map<string, RawItem>();
  for (const item of items) {
    const key = canonicalUrl(item.url);
    const existing = byUrl.get(key);
    if (!existing || (item.engagement && !existing.engagement)) {
      byUrl.set(key, { ...item, url: key });
    }
  }
  return [...byUrl.values()];
}
