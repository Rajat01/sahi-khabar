import type { Saga, Story } from "../lib/types";
import { properNouns, TITLE_CASE_NOISE } from "./normalize";

/**
 * Second-level grouping: a SAGA is a set of distinct stories (each with its
 * own score) orbiting one running narrative over days — "Sonam Wangchuk
 * protest", not "Kerala High Court" (which rules on dozens of unrelated
 * cases a week and must never become one fake saga). Developments stay
 * separate stories; the feed collapses them into one hub card so a busy
 * news cycle doesn't read as editorial obsession.
 *
 * Guardrail learned twice now (once in clustering, again here): one shared
 * word is never enough. A candidate "seed" entity finds the story pool, but
 * two stories only join the same saga if they ALSO share a second proper
 * noun — a co-defendant, a place, a companion name — the same signal that
 * fixed cluster.ts over-merging. This is what keeps "Kerala High Court" from
 * swallowing every unrelated Kerala High Court case into one fake saga.
 */
const MIN_SAGA_STORIES = 4;
const MAX_SAGA_STORIES = 40;

const GENERIC_ENTITY =
  /^(india|indian|indias|bharat|delhi|mumbai|bengaluru|kolkata|chennai|hyderabad|modi|bjp|congress|aap|tmc|dmk|senate|centre|center|government|govt|supreme|high|court|police|minister|ministry|parliament|assembly|state|states|city|world|us|uk|china|pakistan|russia|ukraine|israel|gaza|trump|europe|american|chinese|russian|kerala|karnataka|maharashtra|tamil|nadu|bengal|gujarat|bihar|punjab|rajasthan|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)$/i;

export function detectSagas(stories: Story[]): Saga[] {
  const storyNouns = new Map<string, Set<string>>();
  const nounStories = new Map<string, Story[]>();
  for (const story of stories) {
    const nouns = properNouns(story.headline);
    storyNouns.set(story.id, nouns);
    for (const noun of nouns) {
      if (noun.length <= 3 || GENERIC_ENTITY.test(noun)) continue;
      const list = nounStories.get(noun) ?? [];
      list.push(story);
      nounStories.set(noun, list);
    }
  }

  const candidates = [...nounStories.entries()]
    .filter(([, list]) => list.length >= MIN_SAGA_STORIES)
    .sort((a, b) => b[1].length - a[1].length);

  const assignment = new Map<string, { noun: string; size: number }>();
  const sagaMembers = new Map<string, Story[]>();

  for (const [noun, pool] of candidates) {
    // Coherence check: connect two pool stories only when they share the
    // seed noun AND at least one more proper noun. The largest resulting
    // component is the real saga; unrelated stories that merely mention the
    // same institution/person in passing fall into their own tiny islands.
    const parent = pool.map((_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = storyNouns.get(pool[i].id)!;
        const b = storyNouns.get(pool[j].id)!;
        let shared = 0;
        for (const n of a) if (b.has(n)) shared++;
        if (shared >= 2) parent[find(i)] = find(j);
      }
    }
    const components = new Map<number, number[]>();
    pool.forEach((_, i) => {
      const root = find(i);
      components.set(root, [...(components.get(root) ?? []), i]);
    });
    const largest = [...components.values()].sort((a, b) => b.length - a.length)[0];
    if (largest.length < MIN_SAGA_STORIES) continue;

    const members = largest.slice(0, MAX_SAGA_STORIES).map((i) => pool[i]);
    // Each story joins at most one saga: whichever qualifying, coherent
    // group is largest (so a Wangchuk story mentioning Aamir Khan in
    // passing still joins the big Wangchuk saga, not a small Aamir one).
    for (const story of members) {
      const current = assignment.get(story.id);
      if (!current || members.length > current.size) {
        assignment.set(story.id, { noun, size: members.length });
      }
    }
    sagaMembers.set(noun, members);
  }

  const finalMembers = new Map<string, Story[]>();
  for (const [storyId, { noun }] of assignment) {
    const story = stories.find((s) => s.id === storyId);
    if (!story) continue;
    const group = finalMembers.get(noun) ?? [];
    group.push(story);
    finalMembers.set(noun, group);
  }

  // Different seed tokens can name the same real-world story (a first name
  // and a surname each independently pass the coherence check with zero
  // story overlap between them). Group by the DISPLAY title, not the seed
  // token, so "Sonam" and "Wangchuk" become one hub instead of two.
  const byTitle = new Map<string, { members: Story[]; noun: string }>();
  for (const [noun, members] of finalMembers) {
    if (members.length < MIN_SAGA_STORIES) continue;
    const title = displayTitle(noun, members);
    const existing = byTitle.get(title);
    if (existing) {
      const seen = new Set(existing.members.map((s) => s.id));
      for (const m of members) if (!seen.has(m.id)) existing.members.push(m);
    } else {
      byTitle.set(title, { members: [...members], noun });
    }
  }

  const sagas: Saga[] = [];
  for (const [title, { members, noun }] of byTitle) {
    members.sort((a, b) => Date.parse(b.latestPublishedAt) - Date.parse(a.latestPublishedAt));
    const id = noun.replace(/[^a-z0-9]+/gi, "-");
    sagas.push({
      id,
      title,
      storyIds: members.map((s) => s.id),
      latestPublishedAt: members[0].latestPublishedAt,
    });
    for (const s of members) s.sagaId = id;
  }
  return sagas.sort((a, b) => b.storyIds.length - a.storyIds.length);
}

/** Most frequent short capitalized phrase (name-shaped) around the entity. */
function displayTitle(token: string, stories: Story[]): string {
  const counts = new Map<string, number>();
  const re = new RegExp(`(?:\\b[A-Z][\\w'’.-]*\\s+){0,1}\\b${token}\\b(?:\\s+[A-Z][\\w'’.-]*){0,1}`, "gi");
  for (const story of stories) {
    for (const match of story.headline.matchAll(re)) {
      const phrase = match[0].trim();
      const words = phrase.split(/\s+/);
      const clean = words.every(
        (w) => /^[A-Z]/.test(w) && !TITLE_CASE_NOISE.has(w.toLowerCase()),
      );
      if (clean) counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? token.charAt(0).toUpperCase() + token.slice(1);
}
