import type { NextConfig } from "next";
import { legacyHostRedirects } from "./lib/site";

function pub(name: string, legacy: string): string {
  return process.env[name] || process.env[legacy] || "";
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [
      { source: "/play-dates", destination: "/sessions", permanent: true },
      { source: "/playdates", destination: "/sessions", permanent: true },
      { source: "/schedule", destination: "/sessions", permanent: true },
      { source: "/", has: [{ type: "query", key: "view", value: "schedule" }], destination: "/sessions", permanent: true },
      { source: "/profile", destination: "/account", permanent: true },
      // Host-scoped, so this is a no-op on *.vercel.app and localhost.
      // permanent is a 308, which browsers cache. Next forwards the query string.
      ...legacyHostRedirects(),
    ];
  },
  eslint: { ignoreDuringBuilds: true },
  // The current Vercel project already has FIREBASE_* (no NEXT_PUBLIC_ prefix).
  // Map them so a later live cutover can reuse those values. Demo mode never initializes Firebase.
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: pub("NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_API_KEY"),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: pub("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "FIREBASE_AUTH_DOMAIN"),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: pub("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID"),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: pub("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "FIREBASE_STORAGE_BUCKET"),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: pub("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_MESSAGING_SENDER_ID"),
    NEXT_PUBLIC_FIREBASE_APP_ID: pub("NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_APP_ID"),
  },
};

export default nextConfig;
