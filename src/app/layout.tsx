import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ConsentManager } from "@/components/site/ConsentManager";
import { BING_VERIFICATION, GSC_VERIFICATION, HAS_CONSENT_TOOLS } from "@/lib/analyticsConfig";
import {
  SITE_DESCRIPTION,
  SITE_INDEXABLE,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Pre-launch: keep every page out of search engines until Jorge flips this.
  // Set NEXT_PUBLIC_SITE_INDEXABLE=true (Production only) in Vercel to allow indexing.
  robots: SITE_INDEXABLE
    ? { index: true, follow: true }
    : { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  // Ownership tags for Google Search Console and Bing Webmaster Tools, on every page,
  // only when their variables are set (docs/SEO.md §7).
  ...(GSC_VERIFICATION || BING_VERIFICATION
    ? {
        verification: {
          ...(GSC_VERIFICATION ? { google: GSC_VERIFICATION } : {}),
          ...(BING_VERIFICATION ? { other: { "msvalidate.01": BING_VERIFICATION } } : {}),
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        {children}
        {/* Vercel Web Analytics: no cookies, always on. */}
        <Analytics />
        {/* Cookie banner + Google Analytics and friends: only when an id is set, only after consent. */}
        {HAS_CONSENT_TOOLS && <ConsentManager />}
      </body>
    </html>
  );
}
