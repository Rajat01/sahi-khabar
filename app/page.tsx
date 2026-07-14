import { Feed } from "../components/Feed";
import { loadDataset, toFeedStory } from "../lib/data";

const MAX_FEED = 150;

export default function HomePage() {
  const { stories, generatedAt } = loadDataset();
  const feed = stories
    .filter((s) => s.articles.length > 0) // discussion-only stories live on /radar
    .slice(0, MAX_FEED)
    .map(toFeedStory);
  return (
    <>
      <h1 className="sr-only">Latest stories</h1>
      <Feed stories={feed} nowIso={generatedAt} />
    </>
  );
}
