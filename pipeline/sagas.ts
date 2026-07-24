import type { Saga, Story } from "../lib/types";
import { properNouns } from "./normalize";

/**
 * Second-level grouping: a SAGA is a set of distinct stories (each with its
 * own score) orbiting one specific entity over days — "Sonam Wangchuk", not
 * "Modi". Developments stay separate stories; the feed collapses them into
 * one hub card so a busy news cycle doesn't read as editorial obsession.
 *
 * Guardrails learned from the clustering over-merge saga: entities that are
 * generic Indian political vocabulary never seed a hub, and an entity in too
 * many stories (Modi-scale) is a topic, not a saga.
 */
const MIN_SAGA_STORIES = 4;
const MAX_SAGA_STORIES = 30;

const GENERIC_ENTITY =
  /^(india|indian|indias|bharat|delhi|mumbai|bengaluru|kolkata|chennai|hyderabad|modi|bjp|congress|aap|tmc|dmk|senate|centre|center|government|govt|supreme|court|police|minister|ministry|parliament|assembly|state|states|city|world|us|uk|china|pakistan|russia|ukraine|israel|gaza|trump|europe|american|chinese|russian|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)$/i;

export function detectSagas(stories: Story[]): Saga[] {
  // document frequency of proper nouns across stories
  const nounStories = new Map<string, Story[]>();
  const storyNouns = new Map<string, Set<string>>();
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

  const candidates = [...nounStories.entries()].filter(
    ([, list]) => list.length >= MIN_SAGA_STORIES && list.length <= MAX_SAGA_STORIES,
  );
  const df = new Map(candidates.map(([noun, list]) => [noun, list.length]));

  // Each story joins at most one saga: the qualifying entity it shares with
  // the MOST other stories (so "Aamir on Wangchuk" joins the Wangchuk hub,
  // not a tiny Aamir one).
  const assignment = new Map<string, string>();
  for (const story of stories) {
    let best: string | undefined;
    for (const noun of storyNouns.get(story.id) ?? []) {
      const count = df.get(noun);
      if (count !== undefined && (best === undefined || count > (df.get(best) ?? 0))) {
        best = noun;
      }
    }
    if (best) assignment.set(story.id, best);
  }

  const sagas: Saga[] = [];
  for (const [noun, list] of candidates) {
    const members = list.filter((s) => assignment.get(s.id) === noun);
    if (members.length < MIN_SAGA_STORIES) continue;
    members.sort((a, b) => Date.parse(b.latestPublishedAt) - Date.parse(a.latestPublishedAt));
    sagas.push({
      id: noun.replace(/[^a-z0-9]+/gi, "-"),
      title: displayTitle(noun, members),
      storyIds: members.map((s) => s.id),
      latestPublishedAt: members[0].latestPublishedAt,
    });
    for (const s of members) s.sagaId = noun.replace(/[^a-z0-9]+/gi, "-");
  }
  return sagas.sort((a, b) => b.storyIds.length - a.storyIds.length);
}

/** Most frequent capitalized surface form around the entity token. */
function displayTitle(token: string, stories: Story[]): string {
  const counts = new Map<string, number>();
  const re = new RegExp(
    `(?:\\b[A-Z][\\w'’.-]*\\s+){0,2}\\b${token}\\b(?:\\s+[A-Z][\\w'’.-]*){0,1}`,
    "gi",
  );
  for (const story of stories) {
    for (const match of story.headline.matchAll(re)) {
      const phrase = match[0].trim();
      // keep only phrases whose every word is capitalized (names, not clauses)
      if (phrase.split(/\s+/).every((w) => /^[A-Z]/.test(w))) {
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }
  const best = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length,
  )[0];
  return best?.[0] ?? token.charAt(0).toUpperCase() + token.slice(1);
}
