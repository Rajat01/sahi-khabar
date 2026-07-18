import { appendFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRedirects } from "./redirects";

/**
 * Runs after `next build` (postbuild): appends 301 rules for absorbed story
 * ids to the exported _redirects file, so links indexed by search engines
 * land on the merged story instead of a 404.
 */
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out", "_redirects");

const redirects = loadRedirects();
const entries = Object.entries(redirects);
if (!existsSync(OUT)) {
  console.warn("[redirects] out/_redirects missing — was next build run?");
} else if (entries.length > 0) {
  const lines = entries
    .flatMap(([from, e]) => [
      `/story/${from} /story/${e.to}/ 301`,
      `/story/${from}/ /story/${e.to}/ 301`,
    ])
    .join("\n");
  appendFileSync(OUT, `\n# absorbed story ids -> their merged stories\n${lines}\n`);
  console.log(`[redirects] appended ${entries.length} story redirect(s) to out/_redirects`);
} else {
  console.log("[redirects] no story redirects recorded yet");
}
