import type { CoverageBuckets } from "../lib/types";

const BUCKETS: { key: keyof CoverageBuckets; label: string }[] = [
  { key: "mainstream", label: "Indian mainstream" },
  { key: "independent", label: "Indian independent" },
  { key: "international", label: "International" },
  { key: "official", label: "Official" },
];

/** Who is (and isn't) covering this story, by editorial bucket. */
export function CoverageStrip({
  coverage,
  blindspot,
}: {
  coverage: CoverageBuckets;
  blindspot?: string;
}) {
  return (
    <div className="mt-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {BUCKETS.map(({ key, label }) => (
          <li
            key={key}
            className={coverage[key] > 0 ? "text-ink-2" : "text-ink-3 line-through decoration-hairline"}
          >
            {label}{" "}
            <span className="font-semibold tabular-nums no-underline">{coverage[key]}</span>
          </li>
        ))}
      </ul>
      {blindspot && (
        <p className="mt-2 rounded-md border border-status-serious/40 bg-surface px-3 py-2 text-xs text-ink-2">
          <span className="font-semibold">Mainstream blindspot:</span> this
          India-relevant story is being covered by independent or international
          outlets, but by none of the Indian mainstream outlets we track.
        </p>
      )}
    </div>
  );
}
