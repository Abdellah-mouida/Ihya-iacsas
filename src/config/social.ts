export const SOCIAL_LINKS = [
  {
    platform: "facebook",
    href: "https://www.facebook.com/share/1F5TaTamYB/",
    labelKey: "social.facebook",
    ariaLabelKey: "social.facebookAria",
  },
  {
    platform: "instagram",
    href: "https://www.instagram.com/i7yae_shabab",
    labelKey: "social.instagram",
    ariaLabelKey: "social.instagramAria",
  },
  {
    platform: "youtube",
    href: "https://youtube.com/@i7yae_shababi",
    labelKey: "social.youtube",
    ariaLabelKey: "social.youtubeAria",
  },
] as const;

export type SocialPlatform = (typeof SOCIAL_LINKS)[number]["platform"];
