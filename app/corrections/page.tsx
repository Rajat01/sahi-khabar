import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { generalReportLink } from "../../lib/report";
import { REPO_URL } from "../../lib/site";
import type { Correction } from "../../pipeline/corrections";

export const metadata: Metadata = {
  title: "Corrections log",
  description:
    "Every fix made in response to a reader-filed report, with the date it was resolved — the closed issues on the public repo, shown here directly.",
  alternates: { canonical: "/corrections/" },
};

function loadCorrections(): Correction[] {
  try {
    const path = join(process.cwd(), "data", "corrections.json");
    return JSON.parse(readFileSync(path, "utf8")) as Correction[];
  } catch {
    return [];
  }
}

export default function CorrectionsPage() {
  const corrections = loadCorrections();
  return (
    <div className="prose-sm max-w-none space-y-4">
      <div>
        <h1 className="text-xl font-bold">Corrections log</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Reader reports go straight to{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
            the public repository
          </a>{" "}
          as GitHub issues — there is no other inbox. When one is resolved and
          labeled a correction, it shows up here automatically, dated by when
          it was actually fixed. Nothing is edited out of this list.{" "}
          <a
            href={generalReportLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            Report an issue →
          </a>
        </p>
      </div>

      {corrections.length === 0 ? (
        <p className="text-sm text-ink-3">
          No corrections logged yet — either nothing has needed one, or none
          has been resolved and labeled yet. This page updates automatically
          as issues are closed.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {corrections.map((c) => (
            <li key={c.url} className="py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
                {new Date(c.closedAt).toLocaleString("en-US", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "UTC",
                })}{" "}
                UTC
              </p>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:text-accent"
              >
                {c.title} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
