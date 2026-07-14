import type { ScoreBreakdown } from "../lib/types";

const BANDS: Record<
  ScoreBreakdown["band"],
  { label: string; dot: string }
> = {
  high: { label: "High confidence", dot: "bg-status-good" },
  medium: { label: "Medium confidence", dot: "bg-status-warning" },
  low: { label: "Low confidence", dot: "bg-status-serious" },
  unverified: { label: "Unverified", dot: "bg-status-muted" },
};

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
  const { label, dot } = BANDS[band];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2 py-0.5 text-xs font-medium text-ink-2"
      title={`Confidence score ${total}/100 — see the story page for the full breakdown`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {compact ? label.replace(" confidence", "") : label}
      {band !== "unverified" && <span className="tabular-nums text-ink-3">{total}</span>}
    </span>
  );
}
