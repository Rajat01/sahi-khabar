import { PRIMARY_SOURCE_DOMAINS, SOURCE_BY_ID } from "../config/sources";
import type {
  Category,
  CoverageBuckets,
  Discussion,
  ScoreBreakdown,
  Story,
  StoryArticle,
} from "../lib/types";
import type { Cluster } from "./cluster";
import { checkHeadlines, type HeadlineCheck } from "./llm";
import { domainOf } from "./normalize";

const WEIGHTS = { corroboration: 40, reliability: 30, primary: 15, sanity: 15 };

/**
 * Turn raw clusters into scored stories. Headlines already LLM-checked in a
 * previous run reuse their verdict — only new headlines cost API calls.
 */
export async function scoreClusters(
  clusters: Cluster[],
  previous: Story[] = [],
): Promise<Story[]> {
  const stories = clusters.map(buildStory).filter((s): s is Story => s !== null);

  const cached = new Map<string, HeadlineCheck>();
  for (const old of previous) {
    if (old.score.llmChecked) cached.set(old.headline, { flags: old.score.flags });
  }
  const unchecked = stories.filter((s) => !cached.has(s.headline));
  const llmChecks = await checkHeadlines(unchecked.map((s) => s.headline));
  const freshChecks = new Map<string, HeadlineCheck | null>();
  unchecked.forEach((s, i) => freshChecks.set(s.headline, llmChecks ? llmChecks[i] : null));

  stories.forEach((story) => {
    applySanityCheck(
      story,
      cached.get(story.headline) ?? freshChecks.get(story.headline) ?? null,
    );
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

  const story: Story = {
    id: cluster.id,
    headline,
    summary,
    region: "world", // set by applyRegion below
    category: categorize(headline + " " + (summary ?? "")),
    categories: categorizeAll(headline + " " + (summary ?? "")),
    articles,
    discussions,
    score: baseScore(articles),
    radarScore: radarScore(articles, discussions),
    coverage: { mainstream: 0, independent: 0, international: 0, official: 0 },
    firstSeenAt: new Date(Math.min(...dates)).toISOString(),
    latestPublishedAt: new Date(Math.max(...dates)).toISOString(),
  };
  applyRegion(story);
  applyCoverage(story);
  return story;
}

/**
 * Region means what the story is ABOUT, not who reported it: a UK election
 * covered by nine Indian outlets is still world news. India when the text is
 * India-relevant or any article came from an India-section feed (whose
 * content is about India by construction). Exported for the heal pass.
 */
export function applyRegion(story: Story): void {
  const text = story.headline + " " + (story.summary ?? "");
  const fromIndiaSection = story.articles.some(
    (a) => SOURCE_BY_ID[a.sourceId]?.scope === "in",
  );
  story.region = INDIA_PATTERN.test(text) || fromIndiaSection ? "in" : "world";
}

const INDIA_PATTERN =
  /\b(india|indian|bharat|hindustan|desi|delhi|mumbai|bengaluru|bangalore|kolkata|chennai|hyderabad|pune|ahmedabad|surat|jaipur|lucknow|kanpur|nagpur|indore|bhopal|patna|noida|gurugram|gurgaon|varanasi|amritsar|kochi|coimbatore|mysuru|guwahati|bhubaneswar|ranchi|raipur|chandigarh|shimla|srinagar|modi|lok sabha|rajya sabha|bjp|congress party|rahul gandhi|amit shah|nirmala sitharaman|kejriwal|mamata|kashmir|ladakh|punjab|kerala|tamil nadu|karnataka|maharashtra|gujarat|bihar|bengal|uttar pradesh|uttarakhand|assam|manipur|odisha|jharkhand|chhattisgarh|telangana|andhra|haryana|himachal|rajasthan|goa|tripura|meghalaya|nagaland|mizoram|sikkim|tmc|dmk|shiv sena|aiadmk|rupee|crore|lakh|rbi|sebi|isro|nifty|sensex|aadhaar|gst|cbi|bollywood|supreme court of india|panchayat)\b/i;

/**
 * Fill in coverage buckets and the blindspot flag. Exported so run.ts can
 * recompute them for stories carried over from previous datasets.
 */
export function applyCoverage(story: Story): void {
  const buckets: CoverageBuckets = {
    mainstream: 0,
    independent: 0,
    international: 0,
    official: 0,
  };
  const seen = new Set<string>();
  for (const article of story.articles) {
    if (seen.has(article.sourceName)) continue;
    seen.add(article.sourceName);
    switch (SOURCE_BY_ID[article.sourceId]?.group) {
      case "in-mainstream":
        buckets.mainstream++;
        break;
      case "in-independent":
        buckets.independent++;
        break;
      case "international":
        buckets.international++;
        break;
      case "official":
        buckets.official++;
        break;
    }
  }
  story.coverage = buckets;

  // Blindspot: an India-relevant story that Indian mainstream outlets are not
  // covering, while others are. Single-source local items don't count — we
  // require either two non-mainstream outlets or one plus community traction,
  // so the page shows genuine gaps rather than every niche story.
  const indiaRelevant =
    story.region === "in" ||
    INDIA_PATTERN.test(story.headline + " " + (story.summary ?? ""));
  const nonMainstream = buckets.independent + buckets.international + buckets.official;
  story.blindspot =
    indiaRelevant &&
    buckets.mainstream === 0 &&
    (nonMainstream >= 2 || (nonMainstream >= 1 && story.discussions.length >= 1))
      ? "mainstream-blindspot"
      : undefined;
}

function baseScore(articles: StoryArticle[]): ScoreBreakdown {
  // Corroboration: count independent outlets (distinct source AND distinct domain).
  const outlets = new Set(articles.map((a) => a.sourceName));
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

// Order matters: first match wins. Sports first (most distinctive vocabulary),
// politics before business so governance stories aren't claimed by stray
// economic words. Every alternative ends at a word boundary — a trailing \w*
// once turned "Bankipur" into a business story and "aid" into tech.
const CATEGORY_KEYWORDS: [Category, RegExp][] = [
  [
    "sports",
    /\b(cricket|footballer?s?|olympics?|world cup|ipl|t20|odi|test match|tennis|semi-?finals?|quarter-?finals?|tournaments?|medals?|athletes?|fifa|premier league|grand slam|playoffs?|wickets?|innings|stadium|coach|captaincy)\b/i,
  ],
  [
    "science",
    /\b(research(ers?)?|study|studies|scientists?|space(craft)?|rockets?|orbits?|orbital|isro|nasa|satellites?|climate|vaccines?|epidemic|pandemic|diseases?|species|physics|quantum|genomes?|fossils?|telescopes?|astronomy)\b/i,
  ],
  [
    "tech",
    /\b(ai|artificial intelligence|software|apps?|google|apple|microsoft|meta|openai|anthropic|chips?|semiconductors?|cyber(attack|security)?|data breach|crypto(currency)?|bitcoin|internet|smartphones?|silicon valley|start-?ups?|aerospace|space-?tech|skyroot|agnikul|pixxel|spacex|blue origin|tech|gadgets?)\b/i,
  ],
  [
    "politics",
    /\b(elections?|by-?polls?|bye-?polls?|polls?|parliament(ary)?|minist(er|ers|ry)|congress|bjp|aap|tmc|dmk|senate|president(ial)?|prime minister|chief minister|courts?|verdicts?|convict(ed|ion)?|bills?|policy|policies|government|governance|votes?|voters?|voting|coalition|sanctions?|diplomat(ic|s)?|treaty|opposition|cabinet|manifesto|constituenc(y|ies)|legislat(ure|ive|ion))\b/i,
  ],
  [
    "business",
    /\b(econom(y|ic|ics|ist)?|markets?|stocks?|sensex|nifty|rupees?|dollars?|inflation|gdp|banks?|banking|rbi|sebi|ipos?|trade|tariffs?|invest(s|ed|ing|ments?|ors?)?|earnings|revenue|profits?|shares|mergers?|acquisitions?|billion|crore|lakh|layoffs?|exports?|imports?)\b/i,
  ],
];

/** All matching categories in priority order; ['other'] when none match. */
export function categorizeAll(text: string): Category[] {
  const matches = CATEGORY_KEYWORDS.filter(([, pattern]) => pattern.test(text)).map(
    ([category]) => category,
  );
  return matches.length > 0 ? matches : ["other"];
}

export function categorize(text: string): Category {
  return categorizeAll(text)[0];
}
