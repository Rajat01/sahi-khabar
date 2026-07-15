import type { Metadata } from "next";
import Link from "next/link";
import { loadDataset } from "../lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KhabarCheck — fact-based news, with receipts",
    template: "%s · KhabarCheck",
  },
  description:
    "News aggregated from real outlets and community signals, with a transparent confidence score and every source shown.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { generatedAt } = loadDataset();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-hairline">
          <div className="mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-4">
            <Link href="/" className="text-xl font-bold tracking-tight">
              KhabarCheck
              <span className="ml-2 text-xs font-normal uppercase tracking-widest text-ink-3">
                खबर चेक
              </span>
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              <Link href="/" className="hover:text-accent">
                Latest
              </Link>
              <Link href="/radar/" className="hover:text-accent">
                Under the Radar
              </Link>
              <Link href="/blindspot/" className="hover:text-accent">
                Blindspots
              </Link>
              <Link href="/check/" className="hover:text-accent">
                Check a forward
              </Link>
              <Link href="/about/" className="hover:text-accent">
                Methodology
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <footer className="border-t border-hairline">
          <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-ink-3">
            <p>
              Every story links to its original sources. Scores are automated
              estimates, not editorial judgments —{" "}
              <Link href="/about/" className="underline hover:text-accent">
                read how they work
              </Link>
              .
            </p>
            <p className="mt-1">
              Last updated {new Date(generatedAt).toUTCString()}. No tracking, no
              accounts, no ads.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
