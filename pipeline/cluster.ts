import { createHash } from "node:crypto";
import { SOURCE_BY_ID } from "../config/sources";
import type { RawItem } from "../lib/types";
import { judgeSameStory } from "./llm";
import { properNouns, tokenize } from "./normalize";

export interface Cluster {
  id: string;
  items: RawItem[]; // outlet articles + reddit/hn discussion items, mixed
}

const STRONG_SIMILARITY = 0.6;
const GREY_ZONE_MIN = 0.3;
const MAX_LLM_PAIRS = 150;

/**
 * Group items describing the same news event.
 * 1. Exact same canonical URL is already merged upstream (normalize.dedupe).
 * 2. TF-IDF cosine over titles: >= STRONG_SIMILARITY auto-merges.
 * 3. Grey-zone pairs sharing proper nouns go to Haiku in one batch; without an
 *    API key those pairs simply stay unmerged (conservative default).
 */
export async function clusterItems(items: RawItem[]): Promise<Cluster[]> {
  const tokens = items.map((it) => tokenize(it.title));
  const nouns = items.map((it) => properNouns(it.title));

  // document frequency for IDF
  const df = new Map<string, number>();
  for (const toks of tokens) {
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = items.length;
  const vectors = tokens.map((toks) => {
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    let norm = 0;
    for (const [t, count] of tf) {
      const idf = Math.log(1 + n / (df.get(t) ?? 1));
      const w = count * idf;
      vec.set(t, w);
      norm += w * w;
    }
    return { vec, norm: Math.sqrt(norm) || 1 };
  });

  const cosine = (i: number, j: number): number => {
    const [small, big] =
      vectors[i].vec.size <= vectors[j].vec.size
        ? [vectors[i], vectors[j]]
        : [vectors[j], vectors[i]];
    let dot = 0;
    for (const [t, w] of small.vec) {
      const w2 = big.vec.get(t);
      if (w2) dot += w * w2;
    }
    return dot / (vectors[i].norm * vectors[j].norm);
  };

  const nounOverlap = (i: number, j: number): number => {
    let count = 0;
    for (const noun of nouns[i]) if (nouns[j].has(noun)) count++;
    return count;
  };

  // union-find
  const parent = items.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  const greyPairs: { i: number; j: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosine(i, j);
      if (sim >= STRONG_SIMILARITY && nounOverlap(i, j) >= 1) {
        union(i, j);
      } else if (sim >= GREY_ZONE_MIN && nounOverlap(i, j) >= 2) {
        greyPairs.push({ i, j });
      }
    }
  }

  // LLM tie-break for grey-zone pairs (skip pairs already merged transitively)
  const pending = greyPairs
    .filter(({ i, j }) => find(i) !== find(j))
    .slice(0, MAX_LLM_PAIRS);
  if (pending.length > 0) {
    const verdicts = await judgeSameStory(
      pending.map(({ i, j }) => ({ a: items[i].title, b: items[j].title })),
    );
    if (verdicts) {
      pending.forEach(({ i, j }, k) => {
        if (verdicts[k]) union(i, j);
      });
      console.log(
        `  [cluster] LLM merged ${verdicts.filter(Boolean).length}/${pending.length} grey-zone pairs`,
      );
    }
  }

  const groups = new Map<number, RawItem[]>();
  items.forEach((item, i) => {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(item);
    groups.set(root, group);
  });

  return [...groups.values()].map((group) => ({
    id: clusterId(group),
    items: group,
  }));
}

/** Stable ID: hash of the earliest outlet article URL (or earliest item URL). */
function clusterId(group: RawItem[]): string {
  const sorted = [...group].sort(
    (a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt),
  );
  const anchor =
    sorted.find((it) => SOURCE_BY_ID[it.sourceId]?.type === "rss") ?? sorted[0];
  return createHash("sha1").update(anchor.url).digest("hex").slice(0, 12);
}
