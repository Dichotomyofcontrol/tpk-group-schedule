import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_ORIGIN}/help`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_ORIGIN}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_ORIGIN}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_ORIGIN}/signin`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
