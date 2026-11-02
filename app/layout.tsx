import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import { NativeBridge } from "@/components/native-bridge";
import { SITE_NAME, SITE_ORIGIN } from "@/lib/site";
import "./globals.css";
import "./almanac.css";

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

const anton = localFont({
  src: "./fonts/Anton-400.woff2",
  variable: "--font-anton",
  weight: "400",
  display: "swap",
});

const mono = localFont({
  src: [
    { path: "./fonts/JetBrainsMono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/JetBrainsMono-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${SITE_NAME}: game night scheduling for tabletop groups`, template: `%s | ${SITE_NAME}` },
  description: "Plan sessions, track who is in, and keep recaps with the campaign. Built for tabletop groups.",
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: { siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0a0c",
};

// Almanac ink is the default. v3 moves everyone onto it once; an explicit paper choice sticks after that.
const themeBoot = `try{if(localStorage.getItem('tpk-text')==='lg')document.documentElement.classList.add('txl');var t=localStorage.getItem('tpk-theme');if(!localStorage.getItem('tpk-theme-v3')){t='dark';localStorage.setItem('tpk-theme','dark');localStorage.setItem('tpk-theme-v3','1');}if(t==='system'){t='dark';localStorage.setItem('tpk-theme','dark');}var night=t!=='light';document.documentElement.dataset.theme=night?'night':'cream';document.documentElement.classList.add('js');var c=night?'#0b0a0c':'#efe7da';addEventListener('DOMContentLoaded',function(){document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.content=c})});}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${anton.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <NativeBridge />
        <Providers allowFixture={process.env.VERCEL_ENV !== "production"}>
          <Suspense fallback={<p style={{ padding: 24 }}>Loading your table…</p>}>
            {children}
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
