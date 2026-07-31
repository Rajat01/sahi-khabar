import type { Metadata } from "next";
import Link from "next/link";
import { REPO_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How KhabarCheck computes reporting-confidence scores, detects media blindspots, and rates outlets — the full methodology and source table.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <div className="prose-sm max-w-none space-y-6">
      <section>
        <h1 className="text-xl font-bold">How KhabarCheck works</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          KhabarCheck (खबर चेक, &ldquo;news, checked&rdquo;) is a fully automated news
          aggregator. There is no newsroom: software fetches stories
          from the sources below every half hour, groups articles that
          describe the same event, and computes a <strong>reporting-confidence score</strong>{" "}
          for each story. We never write news — every headline links to the outlet
          that published it.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Automated doesn&rsquo;t mean unaccountable. The feed is generated
          without a human in the loop, but the system isn&rsquo;t: reader
          reports, methodology changes, and anything that looks like a
          high-risk error are reviewed by the person who built and maintains
          it — publicly, since{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
            the repository
          </a>{" "}
          and every{" "}
          <a
            href={`${REPO_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            reader-filed issue
          </a>{" "}
          are open for anyone to read. Resolved corrections are listed on the{" "}
          <Link href="/corrections/" className="underline hover:text-accent">
            corrections log
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">The reporting-confidence score (0–100)</h2>
        <p className="mt-2 text-sm text-ink-2">
          It measures the <strong>strength and diversity of available
          reporting</strong> — not whether every claim in the story is true.
          Seven outlets can repeat the same wrong claim; one excellent reporter
          can break a true story alone. Read the score accordingly.
        </p>
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
                How many <em>independent reporting origins</em> a story has —
                not a raw outlet count. Outlets under shared ownership (Mint +
                Hindustan Times), copies of the same wire report (PTI, ANI,
                Reuters), and articles that merely cite another outlet&rsquo;s
                reporting collapse into one origin. One origin scores low; five
                score full marks. Known limit: we analyse headlines and
                summaries, so several outlets independently covering the same
                single statement can still overcount — flagging
                single-statement stories is planned.
              </td>
            </tr>
            <tr className="border-b border-hairline align-top">
              <td className="py-2 pr-3 font-medium text-ink">Source reliability</td>
              <td className="py-2 pr-3 tabular-nums">30</td>
              <td className="py-2">
                The average rating of the outlets involved, from a
                hand-maintained per-outlet score kept in the source code.
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
          <strong>Bands:</strong> <em>Widely reported</em> is 75+,{" "}
          <em>Partially corroborated</em> is 50–74, <em>Limited reporting</em>{" "}
          is below 50. A story covered by a single lower-rated outlet is marked{" "}
          <strong>Not independently corroborated</strong> regardless of its
          number.
        </p>
        <p className="mt-2 text-sm text-ink-2">
          The score estimates <em>how well-corroborated a story is right now</em> —
          it is not a truth verdict. Breaking news often starts as{" "}
          <em>Not independently corroborated</em> and climbs as more outlets
          confirm it. Stories that surfaced within the
          last two hours from a single outlet carry a{" "}
          <strong>Developing</strong> tag: they appear early by design, and
          their score should be expected to move.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold">How the feed is ordered</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          The home feed is ranked, not purely chronological: a story&rsquo;s
          position comes from its recency (half-life of ~18 hours), how many
          outlets corroborate it, and a category weight — tech and sports are
          down-weighted (×0.6) so a gadget launch never outranks a court
          verdict. By default the ordering carries no built-in preference for
          India or World stories either way; use those tabs to focus on one.{" "}
          <strong>Nothing is ever removed by ranking</strong>: every ingested
          story keeps its page, appears in region and topic filters, and ships
          in the sitemap and RSS feed.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Automated is not the same as neutral. Recency half-life, the
          tech/sports discount, corroboration weight — each is a choice about
          what matters more, made by one person, encoded in software instead
          of an editor&rsquo;s desk. No ranking of news is neutral in an
          absolute sense; ours doesn&rsquo;t claim to be. What we can offer
          instead is <strong>transparency</strong>: every weight above is
          published here and in{" "}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            the source code
          </a>
          , specifically so it can be read, argued with, and disputed —
          rather than trusted on faith.
        </p>
      </section>

      <section id="developing-stories">
        <h2 className="text-base font-semibold">Ongoing story hubs</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          A single running story — a protest, a court case, a crisis — can
          produce a dozen separate developments in a few days: health updates,
          political reactions, celebrity comments, court orders. Each is its
          own verified story with its own score, but showing all of them as
          separate feed entries reads as repetition. When four or more
          stories share a specific, non-generic detail — not just a topic
          like &ldquo;Kerala High Court,&rdquo; which rules on unrelated
          cases daily — they collapse into one <strong>ongoing story</strong>{" "}
          card showing the latest development, linking to a page with the
          full timeline. Nothing is hidden: every development keeps its own
          page, score, and place in the region/topic filters and sitemap; the
          hub only changes how the home feed displays them together.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          <strong>Known limits:</strong> grouping runs on shared names and
          places extracted from headlines, not on understanding what a
          development actually says — it can occasionally miss a development
          or, rarely, group two similar-sounding but unrelated stories.
          Splitting developments into background / reactions / claims-checked
          (as opposed to one flat timeline) needs deeper analysis of each
          article and isn&rsquo;t built yet.
        </p>
      </section>

      <section id="sustainability">
        <h2 className="text-base font-semibold">Sustainability &amp; our promises</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          KhabarCheck currently runs on a few dollars a month and carries no
          ads and no accounts. As it grows, keeping it running may mean adding
          revenue — clearly labeled sponsorships or ads, reader support, or
          optional accounts for features like saved topics. We would rather be
          honest about that possibility than make promises we might have to
          break. One promise <em>is</em> permanent:{" "}
          <strong>we will never track our readers</strong> — no behavioural
          profiling, no selling data, no third-party trackers, whatever the
          revenue model. Anything optional (like an account) will stay
          optional, and everything commercial will be labeled as such.
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
          shows who is reporting the claim and how strongly it is corroborated; no match
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

      <section id="reliability-governance">
        <h2 className="text-base font-semibold">Source reliability table</h2>
        <p className="mt-2 text-sm text-ink-2">
          Ratings (0–100) are opinions, seeded from public press-reliability
          research and maintained in the open — the full list ships with the
          site&rsquo;s source code so anyone can audit or dispute it.
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
            India vs. World tagging relies on keyword matching and can
            occasionally mistag a story — most often a niche foreign
            business/tech story that names a company but not a country.
          </li>
          <li>
            Non-news service content — horoscopes, puzzle answers, lottery
            results, multi-event digests — is dropped at ingestion; it
            isn&rsquo;t reporting.
          </li>
          <li>
            The reliability table is a maintained opinion, not an objective fact.
          </li>
        </ul>
      </section>
    </div>
  );
}
