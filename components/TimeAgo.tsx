/**
 * Relative time computed against the dataset's generatedAt (baked at build),
 * not Date.now() — keeps server and client renders identical, and the site
 * rebuilds every couple of hours anyway.
 */
export function timeAgo(iso: string, nowIso: string): string {
  const diffMs = Date.parse(nowIso) - Date.parse(iso);
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function TimeAgo({ iso, nowIso }: { iso: string; nowIso: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toUTCString()} className="text-ink-3">
      {timeAgo(iso, nowIso)}
    </time>
  );
}
