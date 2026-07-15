import type { Metadata } from "next";
import { Feed } from "../components/Feed";
import { loadDataset, toFeedStory } from "../lib/data";
import { rankStories } from "../lib/rank";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const MAX_FEED = 250;

export default function HomePage() {
  const { stories, generatedAt } = loadDataset();
  const feed = rankStories(
    stories.filter((s) => s.articles.length > 0), // discussion-only stories live on /radar
    generatedAt,
  )
    .slice(0, MAX_FEED)
    .map(toFeedStory);
  return (
    <>
      <h1 className="sr-only">Latest stories</h1>
      <Feed stories={feed} nowIso={generatedAt} />
    </>
  );
}
