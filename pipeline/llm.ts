import Anthropic from "@anthropic-ai/sdk";

/**
 * All LLM usage is optional: every function degrades gracefully to null when
 * ANTHROPIC_API_KEY is absent, so the pipeline never hard-depends on it.
 * Haiku is used deliberately (cheap, high-volume classification work) — the
 * budget for this whole project is a few dollars a month.
 */
const MODEL = "claude-haiku-4-5";

let client: Anthropic | null | undefined;

function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  if (!client) console.log("  [llm] ANTHROPIC_API_KEY not set — using heuristics only");
  return client;
}

/**
 * Batch-decide whether borderline title pairs describe the same story.
 * Returns null (caller falls back to heuristics) on any failure.
 */
export async function judgeSameStory(
  pairs: { a: string; b: string }[],
): Promise<boolean[] | null> {
  const c = getClient();
  if (!c || pairs.length === 0) return null;
  const list = pairs
    .map((p, i) => `${i + 1}. A: "${p.a}"\n   B: "${p.b}"`)
    .join("\n");
  try {
    const response = await c.messages.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content:
            `For each numbered pair of news headlines, decide if they report the SAME underlying news event (not just the same topic).\n\n${list}\n\n` +
            `Reply with a JSON array of booleans only, one per pair, e.g. [true,false,...]`,
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== pairs.length) return null;
    return parsed.map(Boolean);
  } catch (err) {
    console.warn(`  [llm] same-story check failed: ${(err as Error).message}`);
    return null;
  }
}

export interface HeadlineCheck {
  flags: string[]; // e.g. ["clickbait headline", "opinion presented as news"]
}

/**
 * Batch sanity-check headlines for clickbait / sensationalism / opinion-as-news.
 * Returns null on any failure so scoring falls back to heuristics.
 */
export async function checkHeadlines(
  headlines: string[],
): Promise<HeadlineCheck[] | null> {
  const c = getClient();
  if (!c || headlines.length === 0) return null;
  const list = headlines.map((h, i) => `${i + 1}. "${h}"`).join("\n");
  try {
    const response = await c.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content:
            `Assess each numbered news headline. For each, list any of these issues that apply: ` +
            `"clickbait", "sensationalized", "opinion presented as news", "unverifiable claim". ` +
            `Most straight news headlines have no issues.\n\n${list}\n\n` +
            `Reply with a JSON array only — one array of issue strings per headline (empty array if clean), ` +
            `e.g. [[],["clickbait"],[]]`,
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== headlines.length) return null;
    return parsed.map((flags) => ({
      flags: Array.isArray(flags) ? flags.map(String) : [],
    }));
  } catch (err) {
    console.warn(`  [llm] headline check failed: ${(err as Error).message}`);
    return null;
  }
}
