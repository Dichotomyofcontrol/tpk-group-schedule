/** Canonical public site. Preview deploys and localhost stay on their own host. */
export const SITE_NAME = "Taverning";
export const SITE_ORIGIN = "https://taverning.com";

/**
 * Old production hosts. Requests here 308 to SITE_ORIGIN with the path and
 * query left intact, so invite and poll links already sent still open.
 * Scoped to these hosts so preview URLs and local dev are unchanged.
 */
export const LEGACY_HOSTS = ["sixinthetpk.com", "www.sixinthetpk.com"] as const;

export function legacyHostRedirects() {
  return LEGACY_HOSTS.flatMap((host) => [
    {
      source: "/",
      has: [{ type: "host" as const, value: host }],
      destination: `${SITE_ORIGIN}/`,
      permanent: true as const,
    },
    {
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${SITE_ORIGIN}/:path*`,
      permanent: true as const,
    },
  ]);
}
