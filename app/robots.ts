import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const live = process.env.VERCEL_ENV === "production";
  return {
    rules: live
      ? { userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/sessions", "/campaigns", "/polls", "/almanac", "/auth/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
