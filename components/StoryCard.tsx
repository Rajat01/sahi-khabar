import Link from "next/link";
import type { FeedStory } from "../lib/data";
import { ScoreBadge } from "./ScoreBadge";
import { TimeAgo } from "./TimeAgo";

export function StoryCard({ story, nowIso }: { story: FeedStory; nowIso: string }) {
  const outletNames = [...new Set(story.sources.map((s) => s.name))];
  const shown = outletNames.slice(0, 3);
  const more = outletNames.length - shown.length;
  return (
    <article className="border-b border-hairline py-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold leading-snug">
          <Link href={`/story/${story.id}/`} className="hover:text-accent">
            {story.headline}
          </Link>
        </h2>
        <span className="flex shrink-0 items-center gap-1.5">
          {story.blindspot && (
            <span
              className="rounded-full border border-status-serious/50 px-2 py-0.5 text-xs font-medium text-ink-2"
              title="India-relevant story with no Indian mainstream coverage in our source list"
            >
              Blindspot
            </span>
          )}
          <ScoreBadge band={story.band} total={story.total} compact />
        </span>
      </div>
      {story.summary && (
        <p className="mt-1 line-clamp-2 text-sm text-ink-2">{story.summary}</p>
      )}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        <TimeAgo iso={story.latestPublishedAt} nowIso={nowIso} />
        {outletNames.length > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>
              {shown.join(", ")}
              {more > 0 && ` +${more} more`}
            </span>
          </>
        )}
        {story.discussionCount > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>
              {story.discussionCount} discussion{story.discussionCount > 1 ? "s" : ""}
            </span>
          </>
        )}
        <span aria-hidden>·</span>
        <span className="uppercase tracking-wide">{story.region === "in" ? "India" : "World"}</span>
      </p>
    </article>
  );
}
