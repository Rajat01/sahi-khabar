import type { Metadata } from "next";
import { Feed } from "../components/Feed";
import { collapseSagasForFeed, loadDataset } from "../lib/data";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const MAX_FEED = 250;

export default function HomePage() {
  const { stories, generatedAt, sagas } = loadDataset();
  const feed = collapseSagasForFeed(
    stories.filter((s) => s.articles.length > 0), // discussion-only stories live on /radar
    generatedAt,
    sagas,
  ).slice(0, MAX_FEED);
  return (
    <>
      <h1 className="sr-only">Latest stories</h1>
      <Feed stories={feed} nowIso={generatedAt} />
    </>
  );
}
