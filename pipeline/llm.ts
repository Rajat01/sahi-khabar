import Anthropic from "@anthropic-ai/sdk";

/**
 * All LLM usage is optional: every function degrades gracefully to null when
 * ANTHROPIC_API_KEY is absent, so the pipeline never hard-depends on it.
 * Haiku is used deliberately (cheap, high-volume classification work) — the
 * budget for this whole project is a few dollars a month.
 *
 * Requests are CHUNKED: one giant call truncates at max_tokens, breaks the
 * JSON, and silently degrades everything to heuristics (the bug that kept
 * production LLM-free for days). One failed chunk only affects its own items.
 */
const MODEL = "claude-haiku-4-5";
const HEADLINE_CHUNK = 40;
const PAIR_CHUNK = 50;

let client: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  client = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ maxRetries: 5 }) // SDK backs off on 429/529 automatically
    : null;
  if (!client) console.log("  [llm] ANTHROPIC_API_KEY not set — using heuristics only");
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Gentle pacing keeps a low-tier API account under its tokens-per-minute cap.
const CHUNK_GAP_MS = 3000;

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Extract the first complete JSON array from a model reply. */
function parseArray(text: string, expectedLength: number): unknown[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== expectedLength) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Extract a JSON object keyed by 1-based item numbers. Keyed output avoids
 * making the model count: a fixed-length array reply drifts by one entry in
 * most 40-item chunks, failing strict validation.
 */
function parseNumberKeyed(text: string, maxIndex: number): Map<number, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const out = new Map<number, unknown>();
    for (const [key, value] of Object.entries(parsed)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 1 || idx > maxIndex) return null;
      out.set(idx, value);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Batch-decide whether borderline title pairs describe the same story.
 * Per-pair null means "no verdict" (caller keeps them unmerged).
 */
export async function judgeSameStory(
  pairs: { a: string; b: string }[],
): Promise<(boolean | null)[] | null> {
  const c = getClient();
  if (!c || pairs.length === 0) return null;

  const results: (boolean | null)[] = [];
  let failures = 0;
  let first = true;
  for (const chunk of chunked(pairs, PAIR_CHUNK)) {
    if (!first) await sleep(CHUNK_GAP_MS);
    first = false;
    const list = chunk
      .map((p, i) => `${i + 1}. A: "${p.a}"\n   B: "${p.b}"`)
      .join("\n");
    try {
      const response = await c.messages.create({
        model: MODEL,
        max_tokens: Math.max(200, chunk.length * 8),
        temperature: 0,
        messages: [
          {
            role: "user",
            content:
              `For each numbered pair of news headlines, decide if they report the SAME underlying news event.\n` +
              `Strict rules: same topic, same party, or same people is NOT enough — different developments or different days are different events. ` +
              `Reaction/analysis of an event counts as the same event. A digest/roundup headline covering multiple events matches nothing.\n\n${list}\n\n` +
              `Reply with one compact single-line JSON array of booleans, one per pair, no other text, e.g. [true,false,...]`,
          },
        ],
      });
      const text = response.content.find((b) => b.type === "text")?.text ?? "";
      const parsed = parseArray(text, chunk.length);
      results.push(...(parsed ? parsed.map((v) => Boolean(v)) : chunk.map(() => null)));
      if (!parsed) {
        failures++;
        console.warn(
          `  [llm] same-story chunk unparseable (stop=${response.stop_reason}, expected ${chunk.length}): ${text.slice(0, 100)}`,
        );
      }
    } catch (err) {
      console.warn(`  [llm] same-story chunk failed: ${(err as Error).message}`);
      results.push(...chunk.map(() => null));
      failures++;
    }
  }
  const judged = results.filter((r) => r !== null).length;
  console.log(
    `  [llm] same-story: judged ${judged}/${pairs.length} pairs` +
      (failures ? ` (${failures} chunk(s) failed)` : ""),
  );
  return judged > 0 ? results : null;
}

export interface HeadlineCheck {
  flags: string[]; // e.g. ["clickbait headline", "opinion presented as news"]
}

/**
 * Batch sanity-check headlines for clickbait / sensationalism / opinion-as-news.
 * Per-headline null means "unchecked" (caller uses heuristics for that one).
 */
export async function checkHeadlines(
  headlines: string[],
): Promise<(HeadlineCheck | null)[] | null> {
  const c = getClient();
  if (!c || headlines.length === 0) return null;

  const results: (HeadlineCheck | null)[] = [];
  let failures = 0;
  let first = true;
  for (const chunk of chunked(headlines, HEADLINE_CHUNK)) {
    if (!first) await sleep(CHUNK_GAP_MS);
    first = false;
    const list = chunk.map((h, i) => `${i + 1}. "${h}"`).join("\n");
    try {
      const response = await c.messages.create({
        model: MODEL,
        max_tokens: Math.max(600, chunk.length * 20),
        temperature: 0,
        messages: [
          {
            role: "user",
            content:
              `Assess each numbered news headline. The possible issues are: ` +
              `"clickbait", "sensationalized", "opinion presented as news", "unverifiable claim". ` +
              `Most straight news headlines have no issues.\n\n${list}\n\n` +
              `Reply with one compact single-line JSON object mapping the NUMBER of each problematic headline ` +
              `to its array of issues. Omit clean headlines entirely. No other text. ` +
              `Example: {"2":["clickbait"],"17":["sensationalized"]} — or {} if all are clean.`,
          },
        ],
      });
      const text = response.content.find((b) => b.type === "text")?.text ?? "";
      const parsed = parseNumberKeyed(text, chunk.length);
      results.push(
        ...(parsed
          ? chunk.map((_, i) => {
              const flags = parsed.get(i + 1);
              return { flags: Array.isArray(flags) ? flags.map(String) : [] };
            })
          : chunk.map(() => null)),
      );
      if (!parsed) {
        failures++;
        console.warn(
          `  [llm] headline chunk unparseable (stop=${response.stop_reason}): ${text.slice(0, 100)}`,
        );
      }
    } catch (err) {
      console.warn(`  [llm] headline chunk failed: ${(err as Error).message}`);
      results.push(...chunk.map(() => null));
      failures++;
    }
  }
  const checked = results.filter((r) => r !== null).length;
  console.log(
    `  [llm] headlines: checked ${checked}/${headlines.length}` +
      (failures ? ` (${failures} chunk(s) failed)` : ""),
  );
  return checked > 0 ? results : null;
}
