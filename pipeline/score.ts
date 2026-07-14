import { PRIMARY_SOURCE_DOMAINS, SOURCE_BY_ID } from "../config/sources";
import type {
  Category,
  Discussion,
  ScoreBreakdown,
  Story,
  StoryArticle,
} from "../lib/types";
import type { Cluster } from "./cluster";
import { checkHeadlines, type HeadlineCheck } from "./llm";
import { domainOf } from "./normalize";

const WEIGHTS = { corroboration: 40, reliability: 30, primary: 15, sanity: 15 };

/** Turn raw clusters into scored stories. One batched LLM call for all headlines. */
export async function scoreClusters(clusters: Cluster[]): Promise<Story[]> {
  const stories = clusters.map(buildStory).filter((s): s is Story => s !== null);

  const llmChecks = await checkHeadlines(stories.map((s) => s.headline));
  stories.forEach((story, i) => {
    applySanityCheck(story, llmChecks ? llmChecks[i] : null);
    story.score.total = Math.round(
      story.score.corroboration +
        story.score.reliability +
        story.score.primarySource +
        story.score.sanityCheck,
    );
    story.score.band = band(story);
  });
  return stories;
}

function buildStory(cluster: Cluster): Story | null {
  const articles: StoryArticle[] = [];
  const discussions: Discussion[] = [];

  for (const item of cluster.items) {
    const source = SOURCE_BY_ID[item.sourceId];
    if (!source) continue;
    if (source.type === "rss") {
      articles.push({
        sourceId: source.id,
        sourceName: source.name,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        summary: item.summary,
      });
    } else if (item.engagement) {
      discussions.push({
        platform: source.type === "hn" ? "hn" : "reddit",
        label: source.type === "hn" ? "Hacker News" : source.name,
        title: item.title,
        url: item.url,
        discussionUrl: item.engagement.discussionUrl,
        score: item.engagement.score,
        comments: item.engagement.comments,
        publishedAt: item.publishedAt,
      });
    }
  }
  if (articles.length === 0 && discussions.length === 0) return null;

  articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  discussions.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // Representative headline: highest-tier outlet's title, else top discussion.
  const lead =
    [...articles].sort(
      (a, b) => (SOURCE_BY_ID[b.sourceId]?.tier ?? 0) - (SOURCE_BY_ID[a.sourceId]?.tier ?? 0),
    )[0] ?? null;
  const headline = lead?.title ?? discussions[0].title;
  const summary = articles.find((a) => a.summary)?.summary;

  const dates = [...articles, ...discussions].map((x) => Date.parse(x.publishedAt));
  const regionVotes = cluster.items.map((it) => SOURCE_BY_ID[it.sourceId]?.region ?? "world");
  const region = regionVotes.filter((r) => r === "in").length > regionVotes.length / 2 ? "in" : "world";

  const story: Story = {
    id: cluster.id,
    headline,
    summary,
    region,
    category: categorize(headline + " " + (summary ?? "")),
    articles,
    discussions,
    score: baseScore(articles),
    radarScore: radarScore(articles, discussions),
    firstSeenAt: new Date(Math.min(...dates)).toISOString(),
    latestPublishedAt: new Date(Math.max(...dates)).toISOString(),
  };
  return story;
}

function baseScore(articles: StoryArticle[]): ScoreBreakdown {
  // Corroboration: count independent outlets (distinct source AND distinct domain).
  const outlets = new Set(articles.map((a) => a.sourceId));
  const domains = new Set(articles.map((a) => domainOf(a.url)));
  const independent = Math.min(outlets.size, domains.size);
  // log-scaled: 1 outlet -> ~15, 2 -> ~25, 3 -> ~32, 5+ -> 40
  const corroboration =
    independent === 0
      ? 0
      : Math.min(WEIGHTS.corroboration, Math.round((WEIGHTS.corroboration * Math.log2(1 + independent)) / Math.log2(6)));

  // Reliability: average tier of participating outlets.
  const tiers = articles
    .map((a) => SOURCE_BY_ID[a.sourceId]?.tier)
    .filter((t): t is number => typeof t === "number");
  const avgTier = tiers.length ? tiers.reduce((a, b) => a + b, 0) / tiers.length : 0;
  const reliability = Math.round((avgTier / 100) * WEIGHTS.reliability);

  // Primary source: an official source in the cluster, or a direct link to one.
  const hasPrimary = articles.some(
    (a) =>
      SOURCE_BY_ID[a.sourceId]?.primarySource ||
      PRIMARY_SOURCE_DOMAINS.some((d) =>
        d.startsWith(".") ? domainOf(a.url).endsWith(d) : domainOf(a.url) === d || domainOf(a.url).endsWith("." + d),
      ),
  );

  return {
    corroboration,
    reliability,
    primarySource: hasPrimary ? WEIGHTS.primary : 0,
    sanityCheck: 0,
    total: 0,
    band: "unverified",
    flags: [],
    llmChecked: false,
  };
}

/** LLM check when available; word-list heuristics otherwise. */
function applySanityCheck(story: Story, llm: HeadlineCheck | null): void {
  let flags: string[];
  if (llm) {
    flags = llm.flags;
    story.score.llmChecked = true;
  } else {
    flags = heuristicFlags(story.headline);
  }
  story.score.flags = flags;
  story.score.sanityCheck = Math.max(0, WEIGHTS.sanity - flags.length * 6);
}

const CLICKBAIT_PATTERNS: [RegExp, string][] = [
  [/\b(shocking|you won'?t believe|jaw[- ]dropping|mind[- ]blowing|stunning)\b/i, "clickbait"],
  [/\b(slams|destroys|obliterates|eviscerates|blasts)\b/i, "sensationalized"],
  [/(!{2,}|\?!)/, "sensationalized"],
  [/\b(must (see|read|watch)|goes viral)\b/i, "clickbait"],
];

function heuristicFlags(headline: string): string[] {
  const flags = new Set<string>();
  for (const [pattern, flag] of CLICKBAIT_PATTERNS) {
    if (pattern.test(headline)) flags.add(flag);
  }
  const words = headline.split(/\s+/);
  const capsWords = words.filter((w) => w.length > 3 && w === w.toUpperCase());
  if (capsWords.length >= 2) flags.add("sensationalized");
  return [...flags];
}

function band(story: Story): ScoreBreakdown["band"] {
  const { articles, score } = story;
  if (articles.length === 0) return "unverified";
  if (articles.length === 1 && (SOURCE_BY_ID[articles[0].sourceId]?.tier ?? 0) < 60) return "unverified";
  if (score.total >= 75) return "high";
  if (score.total >= 50) return "medium";
  return "low";
}

/** High community engagement x low mainstream coverage = under the radar. */
function radarScore(articles: StoryArticle[], discussions: Discussion[]): number {
  if (discussions.length === 0) return 0;
  // A top-of-day post with unknown counts (RSS path) is weighted like a
  // ~100-point post rather than pretending it has zero engagement.
  const engagement = discussions.reduce(
    (sum, d) =>
      sum +
      (d.score === undefined
        ? 2
        : Math.log10(1 + d.score) + 0.5 * Math.log10(1 + (d.comments ?? 0))),
    0,
  );
  const coveragePenalty = Math.max(0, 1 - articles.length / 3);
  return Math.round(engagement * coveragePenalty * 10);
}

const CATEGORY_KEYWORDS: [Category, RegExp][] = [
  [
    "business",
    /\b(econom|market|stock|rupee|dollar|inflation|gdp|bank|rbi|sebi|ipo|startup|trade|tariff|invest|earnings|revenue|billion|crore)\w*/i,
  ],
  [
    "tech",
    /\b(ai|artificial intelligence|software|app|google|apple|microsoft|meta|openai|anthropic|chip|semiconductor|cyber|data breach|crypto|internet|smartphone|tech)\w*/i,
  ],
  [
    "science",
    /\b(research|study|scientist|space|isro|nasa|climate|vaccine|health|disease|species|physic|quantum|genome|fossil)\w*/i,
  ],
  ["sports", /\b(cricket|football|olympic|world cup|ipl|tennis|match|tournament|medal|athlete)\w*/i],
  [
    "politics",
    /\b(election|parliament|minister|congress|bjp|senate|president|prime minister|court|supreme court|bill|policy|government|vote|coalition|sanction)\w*/i,
  ],
];

function categorize(text: string): Category {
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return "other";
}
