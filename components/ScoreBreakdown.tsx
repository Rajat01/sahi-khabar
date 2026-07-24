import type { ScoreBreakdown as Breakdown } from "../lib/types";

const COMPONENTS: {
  key: "corroboration" | "reliability" | "primarySource" | "sanityCheck";
  max: number;
  label: string;
  explains: string;
}[] = [
  {
    key: "corroboration",
    max: 40,
    label: "Corroboration",
    explains: "independent reporting origins",
  },
  {
    key: "reliability",
    max: 30,
    label: "Source reliability",
    explains: "track record of the outlets involved",
  },
  {
    key: "primarySource",
    max: 15,
    label: "Primary source",
    explains: "links to official documents or statements",
  },
  {
    key: "sanityCheck",
    max: 15,
    label: "Headline check",
    explains: "free of clickbait and opinion-as-news",
  },
];

/** Four single-hue meters — magnitude, not identity, so one accent colour. */
export function ScoreBreakdown({ score }: { score: Breakdown }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Reporting confidence</h3>
        <span className="text-2xl font-semibold tabular-nums">
          {score.total}
          <span className="text-sm font-normal text-ink-3">/100</span>
        </span>
      </div>
      <dl className="mt-3 space-y-3">
        {COMPONENTS.map(({ key, max, label, explains }) => {
          const value = score[key];
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between text-xs">
                <dt className="font-medium text-ink-2">
                  {label}
                  <span className="ml-1.5 hidden text-ink-3 sm:inline">— {explains}</span>
                </dt>
                <dd className="tabular-nums text-ink-3">
                  {value}/{max}
                </dd>
              </div>
              <div
                className="mt-1 h-2 w-full rounded-full bg-meter-track"
                role="meter"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={`${label}: ${value} of ${max}`}
              >
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${Math.max(value > 0 ? 4 : 0, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </dl>
      {score.origins !== undefined &&
        score.outletCount !== undefined &&
        score.outletCount > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            {score.origins} independent reporting{" "}
            {score.origins === 1 ? "origin" : "origins"} across{" "}
            {score.outletCount} outlet{score.outletCount === 1 ? "" : "s"} —
            shared ownership, reprinted wire copy, and articles citing another
            outlet&rsquo;s reporting count once.
          </p>
        )}
      {score.flags.length > 0 && (
        <p className="mt-3 text-xs text-ink-2">
          <span className="font-medium">Flags:</span> {score.flags.join(", ")}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-3">
        {score.llmChecked
          ? "Headline check performed by an AI model."
          : "Headline check performed by keyword heuristics."}{" "}
        <a href="/about/" className="underline hover:text-accent">
          How scoring works →
        </a>
      </p>
    </div>
  );
}
