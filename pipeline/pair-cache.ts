import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Same-story verdicts persist across runs (in the data branch, next to
 * stories.json). Without this the LLM re-judges the same pairs every two
 * hours, saturating the per-run budget so low-priority-but-valid candidates
 * (single-shared-noun pairs) never get judged at all.
 */
const CACHE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "pair-cache.json",
);
const MAX_AGE_MS = 7 * 86400_000;

interface Entry {
  same: boolean;
  ts: number;
}

export function pairKey(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return createHash("sha1").update(`${x}||${y}`).digest("hex").slice(0, 16);
}

export function loadPairCache(): Map<string, boolean> {
  try {
    const raw = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Record<string, Entry>;
    const cutoff = Date.now() - MAX_AGE_MS;
    return new Map(
      Object.entries(raw)
        .filter(([, e]) => e.ts > cutoff)
        .map(([k, e]) => [k, e.same]),
    );
  } catch {
    return new Map();
  }
}

export function savePairCache(cache: Map<string, boolean>): void {
  // keep previously stored (still-fresh) entries plus this run's new ones
  const out: Record<string, Entry> = {};
  const now = Date.now();
  let existing: Record<string, Entry> = {};
  try {
    existing = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Record<string, Entry>;
  } catch {
    /* first run */
  }
  const cutoff = now - MAX_AGE_MS;
  for (const [k, e] of Object.entries(existing)) {
    if (e.ts > cutoff) out[k] = e;
  }
  for (const [k, same] of cache) {
    if (!out[k]) out[k] = { same, ts: now };
  }
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(out));
}
