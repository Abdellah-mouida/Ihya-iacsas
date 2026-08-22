import {
  BookOpen,
  HandHeart,
  MessagesSquare,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export const IMAGES = {
  eventPoster: "/images/event-poster.jpg",
  nightPoster: "/images/night-poster.jpg",
  quoteCard: "/images/quote-card.jpg",
  journeyCard: "/images/journey-card.jpg",
  football: "/images/football.jpg",
  prayer: "/images/prayer.jpg",
  gathering: "/images/gathering.jpg",
  groupPortrait: "/images/group-portrait.jpg",
  logoBanner: "/images/logo-banner.jpg",
  logoSquare: "/images/logo-square.jpg",
} as const;

export const EVENT = {
  phone: "0615789337",
  phoneHref: "tel:+212615789337",
  bookHref: "/events/majlis-ihyaa/book",
} as const;

export type NavLink = { key: string; href: string };
export const NAV_LINKS: NavLink[] = [
  { key: "nav.home", href: "#home" },
  { key: "nav.about", href: "#about" },
  { key: "nav.activities", href: "#activities" },
  { key: "nav.event", href: "#event" },
  { key: "nav.branches", href: "#branches" },
  { key: "nav.gallery", href: "#gallery" },
  { key: "nav.contact", href: "#contact" },
];

export type IconItem = {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
};

export const ABOUT_CARDS: IconItem[] = [
  {
    icon: Users,
    titleKey: "about.cardGatheringsTitle",
    descKey: "about.cardGatheringsDesc",
  },
  {
    icon: HandHeart,
    titleKey: "about.cardActivitiesTitle",
    descKey: "about.cardActivitiesDesc",
  },
  {
    icon: BookOpen,
    titleKey: "about.cardContentTitle",
    descKey: "about.cardContentDesc",
  },
];

export type Activity = IconItem & { num: string };
export const ACTIVITIES: Activity[] = [
  {
    num: "01",
    icon: MessagesSquare,
    titleKey: "activities.gatheringsTitle",
    descKey: "activities.gatheringsDesc",
  },
  {
    num: "02",
    icon: Trophy,
    titleKey: "activities.sportsTitle",
    descKey: "activities.sportsDesc",
  },
  {
    num: "03",
    icon: BookOpen,
    titleKey: "activities.learningTitle",
    descKey: "activities.learningDesc",
  },
];

export type Branch = { id: string; nameKey: string };
export const BRANCHES: Branch[] = [
  { id: "marrakech", nameKey: "branches.marrakech" },
  { id: "taroudant", nameKey: "branches.taroudant" },
  { id: "famzguid", nameKey: "branches.famzguid" },
  { id: "ouledteima", nameKey: "branches.ouledteima" },
];

export type GalleryItem = { src: string; altKey: string; w: number; h: number };
export const GALLERY: GalleryItem[] = [
  { src: IMAGES.gathering, altKey: "gallery.altGathering", w: 590, h: 332 },
  { src: IMAGES.prayer, altKey: "gallery.altPrayer", w: 1280, h: 960 },
  { src: IMAGES.groupPortrait, altKey: "gallery.altGroup", w: 2048, h: 1516 },
  { src: IMAGES.football, altKey: "gallery.altFootball", w: 1280, h: 960 },
  { src: IMAGES.nightPoster, altKey: "gallery.altNight", w: 512, h: 640 },
  { src: IMAGES.journeyCard, altKey: "gallery.altJourney", w: 526, h: 526 },
  { src: IMAGES.quoteCard, altKey: "gallery.altQuote", w: 526, h: 526 },
];
