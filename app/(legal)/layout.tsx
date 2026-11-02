import type { Viewport } from "next";

/** Legal pages allow pinch zoom. The rest of the app keeps the iOS shell's locked viewport. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0b0a0c",
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
