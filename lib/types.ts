export type SourceType = "rss" | "reddit" | "hn";
export type Region = "in" | "world";

/** Editorial bucket used for blindspot analysis (outlets only). */
export type SourceGroup =
  | "in-mainstream" // large Indian commercial outlets
  | "in-independent" // independent/non-profit Indian newsrooms
  | "international" // non-Indian outlets
  | "official"; // government/primary sources

export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  /** Feed URL for rss, subreddit name for reddit, unused for hn */
  url: string;
  homepage: string;
  region: Region;
  /** 0-100 editorial reliability rating. Only outlets (rss) have one. */
  tier?: number;
  /** True for official/primary sources like PIB (government press releases). */
  primarySource?: boolean;
  /** Editorial bucket for blindspot analysis. Outlets only. */
  group?: SourceGroup;
  /** Who owns/funds this outlet — shown openly in the UI. Outlets only. */
  ownership?: string;
}

/** One fetched item before clustering. */
export interface RawItem {
  sourceId: string;
  title: string;
  url: string;
  publishedAt: string; // ISO 8601
  summary?: string;
  engagement?: {
    /** Upvotes/points — undefined when the source only exposes RSS (no counts). */
    score?: number;
    comments?: number;
    discussionUrl: string;
  };
}

/** An outlet article inside a story cluster. */
export interface StoryArticle {
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string;
  summary?: string;
}

/** A Reddit/HN discussion attached to a story cluster. */
export interface Discussion {
  platform: "reddit" | "hn";
  label: string; // e.g. "r/india" or "Hacker News"
  title: string;
  url: string; // the linked article URL
  discussionUrl: string;
  /** Undefined when the platform only exposes RSS (no vote counts). */
  score?: number;
  comments?: number;
  publishedAt: string;
}

export interface ScoreBreakdown {
  /** 0-40: independent outlets corroborating the story */
  corroboration: number;
  /** 0-30: average reliability rating of the outlets involved */
  reliability: number;
  /** 0-15: links to an official/primary source */
  primarySource: number;
  /** 0-15: headline sanity check (LLM when available, heuristics otherwise) */
  sanityCheck: number;
  total: number;
  band: "high" | "medium" | "low" | "unverified";
  /** Issues found by the sanity check, e.g. "clickbait headline" */
  flags: string[];
  llmChecked: boolean;
}

export type Category =
  | "politics"
  | "business"
  | "tech"
  | "science"
  | "sports"
  | "other";

/** Unique-outlet counts per editorial bucket. */
export interface CoverageBuckets {
  mainstream: number;
  independent: number;
  international: number;
  official: number;
}

export interface Story {
  id: string;
  headline: string;
  summary?: string;
  region: Region;
  category: Category;
  articles: StoryArticle[];
  discussions: Discussion[];
  score: ScoreBreakdown;
  /** Higher = more community engagement with less mainstream coverage. */
  radarScore: number;
  coverage: CoverageBuckets;
  /** Set when an India-relevant story has zero Indian-mainstream coverage. */
  blindspot?: "mainstream-blindspot";
  firstSeenAt: string;
  latestPublishedAt: string;
}

export interface Dataset {
  generatedAt: string;
  stories: Story[];
  sourceStatus: { sourceId: string; ok: boolean; items: number; error?: string }[];
}
