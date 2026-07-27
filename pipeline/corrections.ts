import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_URL } from "../lib/site";

/**
 * Every report filed through lib/report.ts lands as a GitHub issue on the
 * public repo. When one gets closed with the "correction" label, it becomes
 * an entry here — a public, dated corrections log with no separate
 * infrastructure: the issue tracker IS the log.
 *
 * Unauthenticated GitHub API calls are rate-limited to 60/hour per IP, which
 * is generous for one call every 30 minutes. Failure is non-fatal: keep
 * whatever was fetched last time rather than blank the page.
 */
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "corrections.json");
const REPO_PATH = new URL(REPO_URL).pathname.replace(/^\//, ""); // "Rajat01/sahi-khabar"

export interface Correction {
  title: string;
  url: string;
  closedAt: string;
}

async function main() {
  const apiUrl = `https://api.github.com/repos/${REPO_PATH}/issues?state=closed&labels=correction&per_page=30&sort=updated&direction=desc`;
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`GitHub API: HTTP ${res.status}`);
    const issues = (await res.json()) as {
      title: string;
      html_url: string;
      closed_at: string | null;
      pull_request?: unknown;
    }[];
    const corrections: Correction[] = issues
      .filter((i) => !i.pull_request && i.closed_at) // issues API also returns PRs
      .map((i) => ({ title: i.title, url: i.html_url, closedAt: i.closed_at! }));
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify(corrections, null, 1));
    console.log(`[corrections] wrote ${corrections.length} closed correction(s)`);
  } catch (err) {
    console.warn(`[corrections] fetch failed, keeping previous file: ${(err as Error).message}`);
  }
}

main();
