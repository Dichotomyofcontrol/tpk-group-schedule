import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

const fraunces = localFont({
  src: [
    { path: "./fonts/Fraunces-Variable.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/Fraunces-Italic-Variable.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Six in the TPK",
  description: "Sessions, RSVPs, and recaps for your table.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F3EDE1",
};

// Cream is the default. The old site stored "dark" for everyone who used it, so reset that once (marker tpk-theme-v2).
const themeBoot = `try{var t=localStorage.getItem('tpk-theme');if(!localStorage.getItem('tpk-theme-v2')){if(t!=='light'){t='light';localStorage.setItem('tpk-theme','light');}localStorage.setItem('tpk-theme-v2','1');}if(t==='system'){t='light';localStorage.setItem('tpk-theme','light');}document.documentElement.dataset.theme=(t==='dark'||t==='night')?'night':'cream';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
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
