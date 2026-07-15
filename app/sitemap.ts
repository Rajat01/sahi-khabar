import type { MetadataRoute } from "next";
import { loadDataset } from "../lib/data";
import { SITE_URL } from "../lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const { stories, generatedAt } = loadDataset();

  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: generatedAt, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/radar/`, lastModified: generatedAt, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/blindspot/`, lastModified: generatedAt, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/check/`, lastModified: generatedAt, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/about/`, changeFrequency: "weekly", priority: 0.6 },
  ];

  const storyPages: MetadataRoute.Sitemap = stories.map((s) => ({
    url: `${SITE_URL}/story/${s.id}/`,
    lastModified: s.latestPublishedAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...pages, ...storyPages];
}
