import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taverning",
    short_name: "Taverning",
    description: "Sessions, RSVPs, and recaps for your table.",
    start_url: "/sessions",
    scope: "/",
    display: "standalone",
    background_color: "#F3EDE1",
    theme_color: "#F3EDE1",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
