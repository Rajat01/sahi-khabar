import type { ScoreBreakdown } from "../lib/types";

/**
 * Labels describe REPORTING, never truth: "widely reported" is a claim about
 * coverage we can defend; "high confidence" reads as a factual-accuracy
 * rating we never computed. Full phrasing on story pages, shorter on cards.
 */
const BANDS: Record<
  ScoreBreakdown["band"],
  { label: string; short: string; dot: string }
> = {
  high: { label: "Widely reported", short: "Widely reported", dot: "bg-status-good" },
  medium: {
    label: "Partially corroborated",
    short: "Partially corroborated",
    dot: "bg-status-warning",
  },
  low: { label: "Limited reporting", short: "Limited reporting", dot: "bg-status-serious" },
  unverified: {
    label: "Not independently corroborated",
    short: "Uncorroborated",
    dot: "bg-status-muted",
  },
};

export const BADGE_TOOLTIP =
  "Reporting confidence: measures the strength and diversity of available reporting — not whether every claim in the story is true.";

/** Status colour is carried by the dot; the text label always says it too. */
export function ScoreBadge({
  band,
  total,
  compact = false,
}: {
  band: ScoreBreakdown["band"];
  total: number;
  compact?: boolean;
}) {
  const { label, short, dot } = BANDS[band];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2 py-0.5 text-xs font-medium text-ink-2"
      title={BADGE_TOOLTIP}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {compact ? short : label}
      {band !== "unverified" && <span className="tabular-nums text-ink-3">{total}</span>}
    </span>
  );
}
