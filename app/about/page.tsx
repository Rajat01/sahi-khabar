import type { Metadata } from "next";
import { SOURCES } from "../../config/sources";
import type { SourceGroup } from "../../lib/types";

export const metadata: Metadata = { title: "Methodology" };

const GROUP_LABELS: Record<SourceGroup, string> = {
  "in-mainstream": "Indian mainstream",
  "in-independent": "Indian independent",
  international: "International",
  official: "Official",
};

export default function AboutPage() {
  const outlets = SOURCES.filter((s) => s.type === "rss").sort(
    (a, b) => (b.tier ?? 0) - (a.tier ?? 0),
  );
  const communities = SOURCES.filter((s) => s.type !== "rss");

  return (
    <div className="prose-sm max-w-none space-y-6">
      <section>
        <h1 className="text-xl font-bold">How Sahi Khabar works</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Sahi Khabar (सही ख़बर, &ldquo;true news&rdquo;) is a fully automated news
          aggregator. There is no newsroom and no editor: software fetches stories
          from the sources below every couple of hours, groups articles that
          describe the same event, and computes a <strong>confidence score</strong>{" "}
          for each story. We never write news — every headline links to the outlet
          that published it.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">The confidence score (0–100)</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="py-2 pr-3 font-medium">Component</th>
              <th className="py-2 pr-3 font-medium">Weight</th>
              <th className="py-2 font-medium">What it measures</th>
            </tr>
          </thead>
          <tbody className="text-ink-2">
            <tr className="border-b border-hairline align-top">
              <td className="py-2 pr-3 font-medium text-ink">Corroboration</td>
              <td className="py-2 pr-3 tabular-nums">40</td>
              <td className="py-2">
                How many independent outlets report the same story. One outlet
                scores low; five outlets score full marks.
              </td>
            </tr>
            <tr className="border-b border-hairline align-top">
              <td className="py-2 pr-3 font-medium text-ink">Source reliability</td>
              <td className="py-2 pr-3 tabular-nums">30</td>
              <td className="py-2">
                The average rating of the outlets involved, from the
                hand-maintained table below.
              </td>
            </tr>
            <tr className="border-b border-hairline align-top">
              <td className="py-2 pr-3 font-medium text-ink">Primary source</td>
              <td className="py-2 pr-3 tabular-nums">15</td>
              <td className="py-2">
                Whether the story links to an official source — government
                releases, court records, regulators, or international bodies.
              </td>
            </tr>
            <tr className="align-top">
              <td className="py-2 pr-3 font-medium text-ink">Headline check</td>
              <td className="py-2 pr-3 tabular-nums">15</td>
              <td className="py-2">
                An automated check for clickbait, sensationalism, and opinion
                presented as news (an AI model when available, keyword heuristics
                otherwise).
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-sm text-ink-2">
          <strong>Bands:</strong> High is 75+, Medium is 50–74, Low is below 50.
          A story covered by a single lower-rated outlet is marked{" "}
          <strong>Unverified</strong> regardless of its number.
        </p>
        <p className="mt-2 text-sm text-ink-2">
          The score estimates <em>how well-corroborated a story is right now</em> —
          it is not a truth verdict. Breaking news often starts Unverified and
          climbs as more outlets confirm it.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Media Blindspots</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Every outlet is assigned an editorial bucket: <em>Indian mainstream</em>{" "}
          (large commercial outlets), <em>Indian independent</em> (non-profit or
          independent newsrooms), <em>international</em>, and <em>official</em>{" "}
          (government sources). A story is flagged as a{" "}
          <strong>mainstream blindspot</strong> when it is India-relevant, has
          zero Indian-mainstream coverage, and is reported by at least two
          non-mainstream outlets (or one plus community discussion). A blindspot
          is a coverage gap, not an accusation — stories can be early, niche, or
          simply missed.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Check a forward</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          The{" "}
          <a href="/check/" className="underline hover:text-accent">
            check tool
          </a>{" "}
          matches pasted text against our last 7 days of stories, entirely on
          your device — nothing you paste is sent anywhere or stored. A match
          shows who is reporting the claim and its confidence score; no match
          means <em>unconfirmed by the outlets we track</em>, not necessarily
          false.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Under the Radar</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Stories with strong engagement on Reddit or Hacker News but little
          mainstream coverage. This surfaces news the big outlets have not picked
          up — sometimes because it is early, niche, or inconvenient; sometimes
          because it is wrong. Community posts are treated purely as{" "}
          <em>discovery signals</em> and never count toward corroboration.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Source reliability table</h2>
        <p className="mt-2 text-sm text-ink-2">
          Ratings (0–100) are opinions, seeded from public press-reliability
          research and maintained in the open — the full list ships with the
          site&rsquo;s source code so anyone can audit or dispute it.
        </p>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="py-2 pr-3 font-medium">Outlet</th>
                <th className="py-2 pr-3 font-medium">Bucket</th>
                <th className="py-2 pr-3 font-medium">Ownership / funding</th>
                <th className="py-2 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody className="text-ink-2">
              {outlets.map((s) => (
                <tr key={s.id} className="border-b border-hairline align-top">
                  <td className="py-2 pr-3">
                    <a
                      href={s.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-ink hover:text-accent"
                    >
                      {s.name}
                    </a>
                    {s.primarySource && (
                      <span className="block text-xs text-ink-3">official / primary source</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{GROUP_LABELS[s.group ?? "international"]}</td>
                  <td className="py-2 pr-3">{s.ownership}</td>
                  <td className="py-2 tabular-nums">{s.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Ownership is listed because concentrated media ownership shapes
          coverage. It does not change an outlet&rsquo;s rating by itself — track
          record does.
        </p>
        <p className="mt-3 text-sm text-ink-2">
          <strong>Engagement signals (not rated, never corroborate):</strong>{" "}
          {communities.map((s) => s.name).join(", ")}.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">Honest limitations</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>
            Wire services (AP, Reuters) no longer publish free feeds; their
            reporting reaches us indirectly through outlets that syndicate them.
          </li>
          <li>
            Twitter/X is not included — its API pricing is beyond this project.
          </li>
          <li>
            Story grouping is automated and occasionally merges or splits stories
            incorrectly.
          </li>
          <li>
            The reliability table is a maintained opinion, not an objective fact.
          </li>
        </ul>
      </section>
    </div>
  );
}
