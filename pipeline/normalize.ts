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

const STOPWORDS = new Set(
  `a an the and or but of in on at to for with by from as is are was were be been
   has have had it its this that these those he she they we you i his her their
   our your not no over after amid says said say new will would could should can
   may might must do does did done up down out off than then so if while about
   into more most other some such only own same too very just also now`
    .split(/\s+/)
    .filter(Boolean),
);

/** Lowercased, de-stopworded, lightly stemmed tokens for similarity math. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9ऀ-ॿ ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));
}

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
