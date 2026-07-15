import type { Metadata } from "next";
import { StoryCard } from "../../components/StoryCard";
import { loadDataset, toFeedStory } from "../../lib/data";

export const metadata: Metadata = {
  title: "Media Blindspots",
  description:
    "India-relevant stories covered by independent or international outlets but missing from Indian mainstream media.",
  alternates: { canonical: "/blindspot/" },
};

const MAX = 50;

export default function BlindspotPage() {
  const { stories, generatedAt } = loadDataset();
  const blindspots = stories
    .filter((s) => s.blindspot === "mainstream-blindspot")
    .sort(
      (a, b) =>
        b.coverage.independent +
        b.coverage.international +
        b.coverage.official -
        (a.coverage.independent + a.coverage.international + a.coverage.official) ||
        Date.parse(b.latestPublishedAt) - Date.parse(a.latestPublishedAt),
    )
    .slice(0, MAX)
    .map(toFeedStory);

  return (
    <>
      <h1 className="text-xl font-bold">Media Blindspots</h1>
      <p className="mt-1 border-b border-hairline pb-4 text-sm text-ink-2">
        India-relevant stories being reported by independent Indian or
        international outlets — but by <strong>none</strong> of the Indian
        mainstream outlets we track. A blindspot doesn&rsquo;t mean a cover-up:
        stories can be early, niche, or simply missed. It means: worth reading
        the sources yourself.
      </p>
      {blindspots.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-3">
          No blindspots detected in the current window — Indian mainstream
          coverage overlaps everything we&rsquo;re tracking right now.
        </p>
      ) : (
        blindspots.map((story) => (
          <StoryCard key={story.id} story={story} nowIso={generatedAt} />
        ))
      )}
    </>
  );
}
