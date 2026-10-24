import type { MetadataRoute } from "next";

/** Proposed production host from design spec. */
const SITE = "https://plinko.onyxlab.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
