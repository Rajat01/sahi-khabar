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
/**
 * Many Indian outlets Title Case Every Word In A Headline, so a naive
 * "capitalized = proper noun" test misfires on ordinary function words
 * ("Here", "Says", "Where To Watch"). This list of common English words
 * that show up capitalized in headline title case is deliberately large —
 * false negatives (missing a real rare name) are cheap; false positives
 * (a filler word with huge document frequency) previously created bogus
 * "sagas" with dozens of unrelated stories.
 */
export const TITLE_CASE_NOISE = new Set(
  `here there this that these those what where when why how who which
   says said say tells told asks ask claims calls call gets get set sets
   makes make takes take comes come goes go meets meet watch watching read
   reading know knows first new now then still just also even only all
   every some many more most other such own same too very can will would
   could should shall not nor but and yet for from with without within
   into onto upon amid after before during over under between against
   about around across along among per via as at by in of on to up out off
   down back away out through than while if unless because since until
   despite though although once again already yet still soon today
   tomorrow yesterday next last week month year day days weeks months
   years top big small major minor key latest breaking exclusive live
   update updates report reports amid amidst versus vs its his her their
   our your my ours yours theirs mine himself herself itself themselves
   who's what's where's here's there's it's let lets let's how's why's
   watch: read: full video photos pics pic images image
   crore crores lakh lakhs rs rupee rupees percent pc cr per`
    .split(/\s+/)
    .filter(Boolean),
);

export function properNouns(title: string): Set<string> {
  const nouns = new Set<string>();
  for (const word of title.split(/\s+/).slice(1)) {
    const m = word.match(/^[A-Z][a-zA-Z]{2,}/);
    const lower = m?.[0].toLowerCase();
    if (lower && !STOPWORDS.has(lower) && !TITLE_CASE_NOISE.has(lower)) {
      nouns.add(lower);
    }
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

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

/**
 * Some feeds double-encode HTML entities ("&amp;#8216;"), so one decode by
 * the RSS parser still leaves "&#8216;" visible in headlines. Decode
 * numeric, hex, and common named entities until the string is stable.
 */
export function decodeEntities(text: string): string {
  let out = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = out
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
    if (next === out) break;
    out = next;
  }
  return out;
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
