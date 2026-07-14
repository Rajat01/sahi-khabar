import type { Metadata } from "next";
import { CheckTool } from "../../components/CheckTool";
import { loadDataset, toCheckStory } from "../../lib/data";

export const metadata: Metadata = { title: "Check a forward" };

export default function CheckPage() {
  const { stories } = loadDataset();
  const corpus = stories.map(toCheckStory);
  return (
    <>
      <h1 className="text-xl font-bold">Check a forward</h1>
      <p className="mt-1 text-sm text-ink-2">
        Got a headline on WhatsApp and not sure it&rsquo;s real? Paste it here —
        we&rsquo;ll match it against the last 7 days of reporting from{" "}
        {corpus.length.toLocaleString()} stories across established outlets, and
        show you who is actually reporting it.
      </p>
      <div className="mt-5">
        <CheckTool corpus={corpus} />
      </div>
      <p className="mt-8 border-t border-hairline pt-3 text-xs text-ink-3">
        Limitations, honestly: the search runs on your device against our 7-day,
        English-language corpus. Old stories, hyper-local claims, and doctored
        images/videos won&rsquo;t match — a &ldquo;no match&rdquo; result means
        &ldquo;unconfirmed&rdquo;, not &ldquo;false&rdquo;.
      </p>
    </>
  );
}
