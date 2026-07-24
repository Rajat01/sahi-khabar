import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreBadge } from "../../../components/ScoreBadge";
import { ScoreBreakdown } from "../../../components/ScoreBreakdown";
import { ShareBar } from "../../../components/ShareBar";
import { TimeAgo } from "../../../components/TimeAgo";
import { loadDataset } from "../../../lib/data";
import { SITE_NAME, SITE_URL } from "../../../lib/site";

export function generateStaticParams() {
  return (loadDataset().sagas ?? []).map((s) => ({ id: s.id }));
}

function getSagaWithStories(id: string) {
  const { stories, sagas, generatedAt } = loadDataset();
  const saga = (sagas ?? []).find((s) => s.id === id);
  if (!saga) return null;
  const byId = new Map(stories.map((s) => [s.id, s]));
  const members = saga.storyIds.map((sid) => byId.get(sid)).filter((s) => s !== undefined);
  return { saga, members, generatedAt };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const found = getSagaWithStories(id);
  if (!found) return { title: "Story" };
  const { saga, members } = found;
  const description = `${members.length} separately verified developments in the ${saga.title} story, oldest to newest, each with its own sources and reporting-confidence score.`;
  return {
    title: `${saga.title} — ${members.length} developments`,
    description,
    alternates: { canonical: `/saga/${saga.id}/` },
    openGraph: {
      type: "website",
      title: `${saga.title} — ${members.length} developments`,
      description,
      url: `${SITE_URL}/saga/${saga.id}/`,
    },
  };
}

export default async function SagaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = getSagaWithStories(id);
  if (!found) notFound();
  const { saga, members, generatedAt } = found;

  const latest = members[0];
  const earliest = members[members.length - 1];
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${saga.title} — developments`,
    itemListElement: members.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/story/${s.id}/`,
    })),
  }).replace(/</g, "\\u003c");

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <Link href="/" className="text-sm text-ink-3 hover:text-accent">
        ← Top Stories
      </Link>
      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
        Ongoing story · {members.length} developments
      </p>
      <h1 className="mt-1 max-w-xl text-2xl font-bold leading-tight">{saga.title}</h1>
      <p className="mt-2 text-sm text-ink-2">
        Tracked since <TimeAgo iso={earliest.firstSeenAt} nowIso={generatedAt} />. Each
        development below is a separately scored story with its own sources —
        this page only groups them so the running story doesn&rsquo;t crowd
        the main feed.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            Latest development
          </h2>
          <div className="mt-2 rounded-lg border border-hairline p-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/story/${latest.id}/`}
                className="text-base font-semibold leading-snug hover:text-accent"
              >
                {latest.headline}
              </Link>
              <ScoreBadge band={latest.score.band} total={latest.score.total} compact />
            </div>
            {latest.summary && <p className="mt-1 text-sm text-ink-2">{latest.summary}</p>}
            <p className="mt-1.5 text-xs text-ink-3">
              <TimeAgo iso={latest.latestPublishedAt} nowIso={generatedAt} /> ·{" "}
              {[...new Set(latest.articles.map((a) => a.sourceName))].slice(0, 3).join(", ")}
            </p>
          </div>
          <ShareBar url={`${SITE_URL}/saga/${saga.id}/`} headline={`${saga.title} — ${members.length} developments`} />

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-3">
            Timeline
          </h2>
          <ol className="mt-2 space-y-3 border-l border-hairline pl-4">
            {members.map((s) => (
              <li key={s.id} className="relative">
                <span
                  className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-ink-3"
                  aria-hidden
                />
                <Link
                  href={`/story/${s.id}/`}
                  className="text-sm font-medium leading-snug hover:text-accent"
                >
                  {s.headline}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                  <TimeAgo iso={s.latestPublishedAt} nowIso={generatedAt} />
                  <span aria-hidden>·</span>
                  <ScoreBadge band={s.score.band} total={s.score.total} compact />
                  <span aria-hidden>·</span>
                  <span>{[...new Set(s.articles.map((a) => a.sourceName))].length} outlets</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <ScoreBreakdown score={latest.score} />
          <p className="mt-3 text-xs text-ink-3">
            Score shown is for the <strong>latest development</strong> only —
            each entry in the timeline has its own independent score. Grouping
            into this hub does not affect any individual story&rsquo;s score.{" "}
            <Link href="/about/#developing-stories" className="underline hover:text-accent">
              How hubs work →
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-8 border-t border-hairline pt-3 text-xs text-ink-3">
        {SITE_NAME} groups developments automatically by shared, specific
        detail — not just a shared topic — so unrelated stories that happen to
        mention the same name or institution don&rsquo;t get lumped together.
        This grouping can occasionally miss a development or split one by
        mistake;{" "}
        <Link href="/about/#developing-stories" className="underline">
          read the method
        </Link>
        .
      </p>
    </article>
  );
}
