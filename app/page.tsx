import type { Metadata } from "next";
import Link from "next/link";
import { Feed } from "../components/Feed";
import { collapseSagasForFeed, loadDataset } from "../lib/data";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const MAX_FEED = 250;

const ACTIONS = [
  { href: "#feed", label: "Compare today's news" },
  { href: "/check/", label: "Check a WhatsApp forward" },
  { href: "/blindspot/", label: "See media blindspots" },
];

export default function HomePage() {
  const { stories, generatedAt, sagas } = loadDataset();
  const feed = collapseSagasForFeed(
    stories.filter((s) => s.articles.length > 0), // discussion-only stories live on /radar
    generatedAt,
    sagas,
  ).slice(0, MAX_FEED);
  return (
    <>
      <div className="border-b border-hairline pb-5">
        <h1 className="max-w-xl text-2xl font-bold leading-tight">
          Don&rsquo;t trust one headline. Check the reporting.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
          KhabarCheck groups coverage of the same event, shows who owns each
          outlet, and explains how strongly a story is independently
          corroborated.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-full border border-hairline px-4 py-1.5 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
      <div id="feed" className="pt-5">
        <Feed stories={feed} nowIso={generatedAt} />
      </div>
    </>
  );
}
