"use client";

import { useState } from "react";
import type { FeedStory } from "../lib/data";
import type { Category, Region } from "../lib/types";
import { StoryCard } from "./StoryCard";

const REGIONS: { value: Region | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in", label: "India" },
  { value: "world", label: "World" },
];

const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "All topics" },
  { value: "politics", label: "Politics" },
  { value: "business", label: "Business" },
  { value: "tech", label: "Tech" },
  { value: "science", label: "Science" },
  { value: "sports", label: "Sports" },
  { value: "other", label: "Other" },
];

export function Feed({ stories, nowIso }: { stories: FeedStory[]; nowIso: string }) {
  const [region, setRegion] = useState<Region | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");

  const filtered = stories.filter(
    (s) =>
      (region === "all" || s.region === region) &&
      (category === "all" || s.category === category),
  );

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm transition-colors ${
      active
        ? "bg-ink text-page"
        : "border border-hairline text-ink-2 hover:border-ink-3"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-3">
        <div className="flex gap-1.5" role="group" aria-label="Region filter">
          {REGIONS.map((r) => (
            <button
              key={r.value}
              className={pill(region === r.value)}
              onClick={() => setRegion(r.value)}
              aria-pressed={region === r.value}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="mx-1 hidden h-4 w-px bg-hairline sm:block" aria-hidden />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topic filter">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              className={pill(category === c.value)}
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-3">
          No stories match these filters right now.
        </p>
      ) : (
        filtered.map((story) => (
          <StoryCard key={story.id} story={story} nowIso={nowIso} />
        ))
      )}
    </div>
  );
}
