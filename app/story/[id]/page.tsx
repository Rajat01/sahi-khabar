import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreBadge } from "../../../components/ScoreBadge";
import { ScoreBreakdown } from "../../../components/ScoreBreakdown";
import { TimeAgo } from "../../../components/TimeAgo";
import { SOURCE_BY_ID } from "../../../config/sources";
import { loadDataset } from "../../../lib/data";

export function generateStaticParams() {
  return loadDataset().stories.map((s) => ({ id: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = loadDataset().stories.find((s) => s.id === id);
  return { title: story?.headline ?? "Story" };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { stories, generatedAt } = loadDataset();
  const story = stories.find((s) => s.id === id);
  if (!story) notFound();

  return (
    <article>
      <Link href="/" className="text-sm text-ink-3 hover:text-accent">
        ← Latest
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="max-w-xl text-2xl font-bold leading-tight">{story.headline}</h1>
        <ScoreBadge band={story.score.band} total={story.score.total} />
      </div>
      {story.summary && <p className="mt-2 text-ink-2">{story.summary}</p>}
      <p className="mt-2 text-xs text-ink-3">
        First seen <TimeAgo iso={story.firstSeenAt} nowIso={generatedAt} /> · latest
        update <TimeAgo iso={story.latestPublishedAt} nowIso={generatedAt} /> ·{" "}
        {story.region === "in" ? "India" : "World"} · {story.category}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            Coverage ({story.articles.length})
          </h2>
          {story.articles.length === 0 && (
            <p className="mt-2 text-sm text-ink-2">
              No established outlet in our source list has covered this yet — that is
              exactly why it appears in{" "}
              <Link href="/radar/" className="underline">
                Under the Radar
              </Link>
              . Treat it as unverified.
            </p>
          )}
          <ul className="mt-2 divide-y divide-hairline">
            {story.articles.map((article) => (
              <li key={article.url} className="py-3">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <span className="text-sm font-medium group-hover:text-accent">
                    {article.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {article.sourceName}
                    {SOURCE_BY_ID[article.sourceId]?.primarySource && " · official source"}
                    {" · "}
                    <TimeAgo iso={article.publishedAt} nowIso={generatedAt} /> ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>

          {story.discussions.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-3">
                Community discussion ({story.discussions.length})
              </h2>
              <ul className="mt-2 divide-y divide-hairline">
                {story.discussions.map((d) => (
                  <li key={d.discussionUrl} className="py-3 text-sm">
                    <a
                      href={d.discussionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <span className="font-medium group-hover:text-accent">{d.title}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {d.label}
                        {d.score !== undefined && ` · ${d.score.toLocaleString()} points`}
                        {d.comments !== undefined && ` · ${d.comments.toLocaleString()} comments`}
                        {" · "}
                        <TimeAgo iso={d.publishedAt} nowIso={generatedAt} /> ↗
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">
                Community posts are engagement signals — they never count as
                corroboration.
              </p>
            </>
          )}
        </div>

        <aside>
          <ScoreBreakdown score={story.score} />
        </aside>
      </div>
    </article>
  );
}
