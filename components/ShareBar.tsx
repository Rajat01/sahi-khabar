"use client";

import { useEffect, useState } from "react";

interface Target {
  name: string;
  href: (url: string, text: string) => string;
  icon: React.ReactNode;
}

/** Share-intent links only — no SDKs, no trackers, nothing loaded from the networks. */
const TARGETS: Target[] = [
  {
    name: "WhatsApp",
    href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    icon: (
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4Zm-3 3.8c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1 0 1.3.9 2.5 1 2.7.2.2 1.8 2.9 4.4 3.9 2.2.9 2.6.7 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.3-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.5-.6c.1-.2.2-.3.1-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4H9Z" />
    ),
  },
  {
    name: "X",
    href: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    icon: (
      <path d="M17.8 3h3l-6.7 7.7L22 21h-6.2l-4.8-6.3L5.4 21h-3l7.2-8.2L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.5 4.7H5.7l11 14.5Z" />
    ),
  },
  {
    name: "Telegram",
    href: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: (
      <path d="M21.9 4.6 19 19.3c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.5L18.5 7c.4-.3-.1-.5-.5-.2L7.9 13.2 3.5 11.8c-1-.3-1-1 .2-1.4l17-6.6c.8-.3 1.5.2 1.2 1.4v-.6Z" />
    ),
  },
  {
    name: "Facebook",
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    icon: (
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    ),
  },
  {
    name: "LinkedIn",
    href: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    icon: (
      <path d="M20.4 3H3.6A.6.6 0 0 0 3 3.6v16.8c0 .3.3.6.6.6h16.8c.3 0 .6-.3.6-.6V3.6a.6.6 0 0 0-.6-.6ZM8.3 18.3H5.7v-8.4h2.6v8.4ZM7 8.8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm11.3 9.5h-2.6v-4.1c0-1 0-2.2-1.4-2.2s-1.6 1-1.6 2.1v4.2h-2.6v-8.4h2.5v1.2h.1c.3-.7 1.2-1.4 2.5-1.4 2.6 0 3.1 1.7 3.1 4v4.6Z" />
    ),
  },
];

export function ShareBar({ url, headline }: { url: string; headline: string }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // navigator only exists client-side; setting state after mount avoids a
  // hydration mismatch on the statically exported page.
  useEffect(() => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      setCanNativeShare(true);
    }
  }, []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // Clipboard API denied (permissions, older browser) — legacy fallback.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-2 transition-colors hover:border-ink-3 hover:text-ink";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Share this story">
      <span className="text-xs uppercase tracking-wide text-ink-3">Share</span>
      {TARGETS.map((t) => (
        <a
          key={t.name}
          href={t.href(url, headline)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Share on ${t.name}`}
          aria-label={`Share on ${t.name}`}
          className={btn}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
            {t.icon}
          </svg>
        </a>
      ))}
      <button type="button" onClick={copy} title="Copy link" aria-label="Copy link" className={btn}>
        {copied ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4" aria-hidden>
            <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
            <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 1 0-6.4-6.4l-1.3 1.3" strokeLinecap="round" />
            <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 1 0 6.4 6.4l1.3-1.3" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title: headline, url }).catch(() => undefined)}
          className="rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
        >
          More…
        </button>
      )}
      {copied && <span className="text-xs text-ink-3" role="status">Link copied</span>}
    </div>
  );
}
