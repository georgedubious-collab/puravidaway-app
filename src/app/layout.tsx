import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PuraVidaWay — Costa Rica Transfers, Sightseeing & Tours",
  description:
    "Private door-to-door transfers with sightseeing stops, driver bidding, 1-day private tours and multi-day eco-expeditions across Costa Rica.",
  // Pre-launch: keep every page out of search engines until Jorge flips this.
  // Set NEXT_PUBLIC_SITE_INDEXABLE=true in Vercel to allow indexing.
  robots:
    process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true"
      ? { index: true, follow: true }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
