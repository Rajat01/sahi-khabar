import type { Metadata } from "next";
import { StoryCard } from "../../components/StoryCard";
import { loadDataset, toFeedStory } from "../../lib/data";

export const metadata: Metadata = {
  title: "Under the Radar",
  description:
    "Stories with high community engagement but little mainstream coverage — news the front pages are missing.",
  alternates: { canonical: "/radar/" },
};

const MAX_RADAR = 40;

export default function RadarPage() {
  const { stories, generatedAt } = loadDataset();
  const radar = stories
    .filter((s) => s.radarScore > 0)
    .sort((a, b) => b.radarScore - a.radarScore)
    .slice(0, MAX_RADAR)
    .map(toFeedStory);

  return (
    <>
      <h1 className="text-xl font-bold">Under the Radar</h1>
      <p className="mt-1 border-b border-hairline pb-4 text-sm text-ink-2">
        Stories with strong community engagement but little mainstream coverage.
        Less coverage means less verification — check the sources on each story
        before trusting it.
      </p>
      {radar.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-3">
          Nothing flying under the radar right now.
        </p>
      ) : (
        radar.map((story) => (
          <StoryCard key={story.id} story={story} nowIso={generatedAt} />
        ))
      )}
    </>
  );
}
