import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">404</p>
      <h1 className="mt-2 text-xl font-bold">This page isn&rsquo;t here any more</h1>
      <div className="mt-4 space-y-3 text-left text-sm leading-relaxed text-ink-2">
        <p>
          If a search engine or an old link sent you here, the story probably
          existed — KhabarCheck is a rolling window of the{" "}
          <strong>last 7 days</strong> of news, and story pages retire as
          stories age out of it.
        </p>
        <p>
          Some story pages also <strong>merge into fuller versions</strong> as
          more outlets report the same event. We redirect those automatically
          whenever we can; a very old link may still slip through.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link
          href="/check/"
          className="rounded-full bg-ink px-4 py-1.5 font-medium text-page"
        >
          Search for the story
        </Link>
        <Link
          href="/"
          className="rounded-full border border-hairline px-4 py-1.5 text-ink-2 hover:border-ink-3"
        >
          Today&rsquo;s top stories
        </Link>
      </div>
      <p className="mt-5 text-xs text-ink-3">
        Remember the headline? Paste it into{" "}
        <Link href="/check/" className="underline">
          Check a forward
        </Link>{" "}
        — if any outlet we track is still reporting it, you&rsquo;ll find its
        current page there.
      </p>
    </div>
  );
}
