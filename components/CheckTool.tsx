"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CheckStory } from "../lib/data";
import { tokenize } from "../lib/text";
import { ScoreBadge } from "./ScoreBadge";

const MATCH_THRESHOLD = 0.22;

interface Match {
  story: CheckStory;
  similarity: number;
}

export function CheckTool({ corpus }: { corpus: CheckStory[] }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);

  // TF-IDF vectors for the corpus, built once in the browser (~750 docs).
  const index = useMemo(() => {
    const docs = corpus.map((s) => tokenize(s.headline + " " + (s.summary ?? "")));
    const df = new Map<string, number>();
    for (const tokens of docs) {
      for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const n = docs.length || 1;
    const idf = (t: string) => Math.log(1 + n / (df.get(t) ?? 1));
    const vectors = docs.map((tokens) => {
      const vec = new Map<string, number>();
      for (const t of tokens) vec.set(t, (vec.get(t) ?? 0) + 1);
      let norm = 0;
      for (const [t, count] of vec) {
        const w = count * idf(t);
        vec.set(t, w);
        norm += w * w;
      }
      return { vec, norm: Math.sqrt(norm) || 1 };
    });
    return { vectors, idf };
  }, [corpus]);

  const matches: Match[] | null = useMemo(() => {
    if (searched === null) return null;
    const qTokens = tokenize(searched);
    if (qTokens.length === 0) return [];
    const qVec = new Map<string, number>();
    for (const t of qTokens) qVec.set(t, (qVec.get(t) ?? 0) + 1);
    let qNorm = 0;
    for (const [t, count] of qVec) {
      const w = count * index.idf(t);
      qVec.set(t, w);
      qNorm += w * w;
    }
    qNorm = Math.sqrt(qNorm) || 1;

    return corpus
      .map((story, i) => {
        let dot = 0;
        for (const [t, w] of qVec) {
          const w2 = index.vectors[i].vec.get(t);
          if (w2) dot += w * w2;
        }
        return { story, similarity: dot / (qNorm * index.vectors[i].norm) };
      })
      .filter((m) => m.similarity >= MATCH_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }, [searched, corpus, index]);

  const best = matches?.[0];

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearched(query.trim());
        }}
      >
        <label htmlFor="check-input" className="text-sm font-medium">
          Paste the headline or claim you received
        </label>
        <textarea
          id="check-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder={'e.g. "Government to give ₹5,000 to every account holder from next month"'}
          className="mt-2 w-full rounded-lg border border-hairline bg-surface p-3 text-sm outline-none placeholder:text-ink-3 focus:border-accent"
        />
        <button
          type="submit"
          disabled={query.trim().length < 6}
          className="mt-2 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-page disabled:opacity-40"
        >
          Check it
        </button>
      </form>

      {matches !== null && (
        <div className="mt-6" aria-live="polite">
          {matches.length === 0 ? (
            <div className="rounded-lg border border-status-serious/40 bg-surface p-4">
              <p className="text-sm font-semibold">
                No credible outlet we track is reporting this.
              </p>
              <p className="mt-1 text-sm text-ink-2">
                That doesn&rsquo;t prove it&rsquo;s false — our corpus covers the
                last 7 days from {""}
                <Link href="/about/" className="underline">
                  these sources
                </Link>
                . But a dramatic claim that no established outlet carries is a
                strong signal to <strong>not forward it</strong> until a source
                appears.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-hairline bg-surface p-4">
                <p className="text-sm font-semibold">
                  {best!.story.outlets.length >= 2
                    ? `Reported by ${best!.story.outlets.length} outlets we track.`
                    : best!.story.outlets.length === 1
                      ? `Reported by one outlet we track (${best!.story.outlets[0]}).`
                      : "Circulating in community discussions, but no outlet we track has reported it."}
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  Closest matching story and its reporting-confidence score below — read
                  the sources before forwarding.
                </p>
              </div>
              <ul className="mt-3 divide-y divide-hairline">
                {matches.map(({ story, similarity }) => (
                  <li key={story.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/story/${story.id}/`}
                        className="text-sm font-medium hover:text-accent"
                      >
                        {story.headline}
                      </Link>
                      <ScoreBadge band={story.band} total={story.total} compact />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {story.outlets.length > 0
                        ? story.outlets.slice(0, 4).join(", ")
                        : "community discussion only"}
                      {" · "}
                      {Math.round(similarity * 100)}% text match
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
