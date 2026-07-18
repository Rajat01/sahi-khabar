import type { Metadata } from "next";
import Link from "next/link";
import { loadDataset } from "../lib/data";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — fact-based news, with receipts`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    types: { "application/rss+xml": `${SITE_URL}/feed.xml` },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

const JSONLD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "खबर चेक",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/opengraph-image`,
  },
]).replace(/</g, "\\u003c");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { generatedAt } = loadDataset();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSONLD }}
        />
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
                Top Stories
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
              Last updated {new Date(generatedAt).toUTCString()}. We never track
              our readers — that one is permanent.{" "}
              <Link href="/about/#sustainability" className="underline hover:text-accent">
                How we plan to sustain this
              </Link>
              .
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
