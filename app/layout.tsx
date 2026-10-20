import type { Metadata, Viewport } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Six in the TPK",
  description: "Play dates for a D&D group. Only the nights you play.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4efe4",
};

const themeBoot = `try{var t=localStorage.getItem('tpk-theme');if(t==='system'){t='light';localStorage.setItem('tpk-theme','light');}document.documentElement.dataset.theme=t==='dark'?'dark':'light';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <Providers allowFixture={process.env.VERCEL_ENV !== "production"}>
          <Suspense fallback={<p style={{ padding: 24 }}>Loading your table…</p>}>
            {children}
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
