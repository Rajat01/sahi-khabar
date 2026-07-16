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
const GREY_ZONE_MIN = 0.22;
// Shared proper nouns are the strongest same-event signal: two headlines that
// both mention a rare name pair ("Tahir Hussain" + "Ankit Sharma") are worth
// an LLM look even when the surrounding wording shares almost nothing.
const RARE_NOUN_IDF = 9;
// LLM-free auto-merge needs a higher bar: three ubiquitous names ("Delhi",
// "BJP", "Centre") sum to ~9, two genuinely rare ones to ~11+.
const AUTO_MERGE_IDF = 12;
const MAX_LLM_PAIRS = 600;
// Weak-signal (grey/heuristic) merges stop once a cluster is this big —
// transitive chaining otherwise snowballs umbrella blobs that weld unrelated
// events together. High-cosine merges stay uncapped.
const MAX_GREY_COMPONENT = 12;

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

  // IDF over proper nouns: how surprising is it that two titles share these?
  const nounDf = new Map<string, number>();
  for (const set of nouns) {
    for (const noun of set) nounDf.set(noun, (nounDf.get(noun) ?? 0) + 1);
  }
  const sharedNounIdf = (i: number, j: number): number => {
    let sum = 0;
    for (const noun of nouns[i]) {
      if (nouns[j].has(noun)) sum += Math.log(1 + n / (nounDf.get(noun) ?? 1));
    }
    return sum;
  };

  // union-find with component sizes
  const parent = items.map((_, i) => i);
  const size = items.map(() => 1);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent[ra] = rb;
    size[rb] += size[ra];
  };
  const withinGreyCap = (a: number, b: number): boolean =>
    size[find(a)] + size[find(b)] <= MAX_GREY_COMPONENT;

  const greyPairs: { i: number; j: number; strength: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const overlap = nounOverlap(i, j);
      if (overlap === 0) continue;
      const sim = cosine(i, j);
      if (sim >= STRONG_SIMILARITY) {
        union(i, j);
      } else if (
        overlap >= 3 &&
        sim >= 0.35 &&
        sharedNounIdf(i, j) >= AUTO_MERGE_IDF &&
        withinGreyCap(i, j)
      ) {
        // several RARE shared names plus similar wording is same-event with
        // high confidence — merge without spending LLM budget
        union(i, j);
      } else if (overlap >= 2) {
        const idf = sharedNounIdf(i, j);
        // candidate when the wording is somewhat close OR the shared names
        // are rare enough to be a same-event signal on their own
        if (sim >= GREY_ZONE_MIN || idf >= RARE_NOUN_IDF) {
          greyPairs.push({ i, j, strength: idf + sim * 5 });
        }
      }
    }
  }

  // LLM tie-break for grey-zone pairs (skip pairs already merged transitively);
  // strongest candidates first so the budget cap trims only the weakest.
  const pending = greyPairs
    .sort((a, b) => b.strength - a.strength)
    .filter(({ i, j }) => find(i) !== find(j))
    .slice(0, MAX_LLM_PAIRS);
  if (pending.length > 0) {
    const verdicts = await judgeSameStory(
      pending.map(({ i, j }) => ({ a: items[i].title, b: items[j].title })),
    );
    if (verdicts) {
      pending.forEach(({ i, j }, k) => {
        if (verdicts[k] && withinGreyCap(i, j)) union(i, j);
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
