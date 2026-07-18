import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * When re-clustering absorbs an old story into a fuller one, its page (which
 * search engines may have indexed) would 404. We remember old-id -> new-id
 * here (persisted on the data branch) and emit Netlify 301s at build time so
 * old links land on the merged story instead.
 */
const REDIRECTS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "redirects.json",
);
// Longer than story lifetime on purpose: search indexes lag by weeks.
const MAX_AGE_MS = 60 * 86400_000;

interface Entry {
  to: string;
  ts: number;
}

export function loadRedirects(): Record<string, Entry> {
  try {
    const raw = JSON.parse(readFileSync(REDIRECTS_PATH, "utf8")) as Record<string, Entry>;
    const cutoff = Date.now() - MAX_AGE_MS;
    return Object.fromEntries(Object.entries(raw).filter(([, e]) => e.ts > cutoff));
  } catch {
    return {};
  }
}

/** Merge new mappings in, flattening chains (a->b, b->c becomes a->c). */
export function saveRedirects(fresh: Map<string, string>): void {
  const all = loadRedirects();
  const now = Date.now();
  for (const [from, to] of fresh) {
    if (from !== to) all[from] = { to, ts: now };
  }
  // repoint chains at their final target (bounded — cycles just stop early)
  for (const [from, entry] of Object.entries(all)) {
    let target = entry.to;
    for (let hop = 0; hop < 5 && all[target] && all[target].to !== from; hop++) {
      target = all[target].to;
    }
    all[from] = { to: target, ts: entry.ts };
  }
  mkdirSync(dirname(REDIRECTS_PATH), { recursive: true });
  writeFileSync(REDIRECTS_PATH, JSON.stringify(all));
}
