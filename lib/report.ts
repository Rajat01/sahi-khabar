import { REPO_URL, SITE_URL } from "./site";

/**
 * Corrections have to go somewhere concrete, and the site has no backend or
 * accounts — so every "report a problem" control deep-links to a pre-filled
 * GitHub issue on the public repo. Each report is public and trackable, and
 * (per app/corrections/page.tsx) the closed, labeled issues double as the
 * site's public corrections log — no separate infrastructure needed.
 */
function issueUrl(title: string, body: string, label: string): string {
  const params = new URLSearchParams({ title, body, labels: label });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

export interface ReportLink {
  label: string;
  href: string;
}

interface ReportableStory {
  id: string;
  headline: string;
  category: string;
  region: "in" | "world";
}

/** Report links scoped to one story — shown on story pages. */
export function storyReportLinks(story: ReportableStory): ReportLink[] {
  const url = `${SITE_URL}/story/${story.id}/`;
  return [
    {
      label: "Wrong summary",
      href: issueUrl(
        `Wrong summary: ${story.headline}`,
        `Story: ${url}\n\nWhat's wrong with the summary:\n`,
        "wrong-summary",
      ),
    },
    {
      label: "Wrongly grouped",
      href: issueUrl(
        `Wrongly grouped stories: ${story.headline}`,
        `Story: ${url}\n\nWhich article(s) on this page don't belong together, or what's missing:\n`,
        "wrong-clustering",
      ),
    },
    {
      label: "Missing source",
      href: issueUrl(
        `Missing source: ${story.headline}`,
        `Story: ${url}\n\nOutlet that covered this but isn't listed:\n`,
        "missing-source",
      ),
    },
    {
      label: "Wrong category/region",
      href: issueUrl(
        `Wrong category or region: ${story.headline}`,
        `Story: ${url}\nCurrently tagged: ${story.category} / ${story.region === "in" ? "India" : "World"}\n\nWhat it should be, and why:\n`,
        "wrong-category",
      ),
    },
    {
      label: "Dispute outlet rating",
      href: issueUrl(
        "Dispute an outlet rating",
        `Story: ${url}\n\nWhich outlet's rating, and why you think it's wrong:\n`,
        "rating-dispute",
      ),
    },
  ];
}

/** Report link for a developing-story hub — shown on saga pages. */
export function sagaReportLink(saga: { id: string; title: string }): ReportLink {
  const url = `${SITE_URL}/saga/${saga.id}/`;
  return {
    label: "Report wrongly grouped developments",
    href: issueUrl(
      `Wrongly grouped developments: ${saga.title}`,
      `Hub: ${url}\n\nWhich development(s) don't belong in this running story:\n`,
      "wrong-clustering",
    ),
  };
}

/** Generic catch-all — shown in the site footer on every page. */
export const generalReportLink: ReportLink = {
  label: "Report an issue",
  href: issueUrl("Issue report", "Describe what's wrong and where you saw it:\n\n", "report"),
};
