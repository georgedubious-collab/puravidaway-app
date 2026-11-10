/**
 * Social media profiles. Each URL comes from an environment variable (set in
 * Vercel); a network is shown only when its URL is set, so nothing renders
 * until the accounts exist. Planned: Facebook, Instagram, TikTok; later YouTube and X.
 *
 * The values are read with literal process.env names so Next.js can inline them
 * into client components at build time.
 */
export type SocialNetwork = "facebook" | "instagram" | "tiktok" | "youtube" | "x";

export interface SocialLink {
  network: SocialNetwork;
  label: string;
  url: string;
}

const RAW: { network: SocialNetwork; label: string; url: string | undefined }[] = [
  { network: "facebook", label: "Facebook", url: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK },
  { network: "instagram", label: "Instagram", url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
  { network: "tiktok", label: "TikTok", url: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK },
  { network: "youtube", label: "YouTube", url: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
  { network: "x", label: "X", url: process.env.NEXT_PUBLIC_SOCIAL_X },
];

/** Only https URLs count, so a typo in Vercel can't produce a broken or unsafe link. */
export const SOCIAL_LINKS: SocialLink[] = RAW.flatMap((s) => {
  const url = (s.url ?? "").trim();
  return /^https:\/\/[^\s]+$/.test(url) ? [{ network: s.network, label: s.label, url }] : [];
});
