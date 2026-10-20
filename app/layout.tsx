import type { Metadata, Viewport } from "next";
import { Crimson_Pro, IM_Fell_English, IM_Fell_English_SC } from "next/font/google";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

const crimson = Crimson_Pro({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson",
  display: "swap",
});
const fell = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-fell",
  display: "swap",
});
const fellSc = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fell-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Six in the TPK",
  description: "Play dates for a D&D group. Only the nights you play.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe2c4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1410" },
  ],
};

const themeBoot = `try{var t=localStorage.getItem('tpk-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${crimson.variable} ${fell.variable} ${fellSc.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <Providers>
          <Suspense fallback={<p style={{ padding: 24 }}>Loading your table…</p>}>
            {children}
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
