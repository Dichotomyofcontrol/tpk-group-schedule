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
  themeColor: "#efe2c4",
};

const themeBoot = `try{var t=localStorage.getItem('tpk-theme');if(t==='system'){t='light';localStorage.setItem('tpk-theme','light');}document.documentElement.dataset.theme=t==='dark'?'dark':'light';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${crimson.variable} ${fell.variable} ${fellSc.variable}`} suppressHydrationWarning>
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
