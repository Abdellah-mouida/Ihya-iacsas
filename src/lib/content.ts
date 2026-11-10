import {
  BookOpen,
  Compass,
  GraduationCap,
  HandHeart,
  MessageCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export const IMAGES = {
  football: "/images/football.jpg",
  prayer: "/images/prayer.jpg",
  gathering: "/images/gathering.jpg",
  groupPortrait: "/images/group-portrait.jpg",
  logoBanner: "/images/logo-banner.jpg",
  logoCircle: "/images/logo-circle.png",
  defaultPoster: "/images/gathering.jpg",
  eventPoster: "/images/gathering.jpg",
} as const;

export const EVENT = {
  phone: "0615789337",
  phoneHref: "tel:+212615789337",
  bookHref: "/book",
} as const;

export const EVENTS_HREF = "/events";

// ---- Events model -------------------------------------------------------
// A single source of truth for events. `status: "open"` events are open for
// booking and shown at the top of /events; `status: "past"` events populate
// the archive. `isNew` on an open event drives the navbar "new event"
// indicator and can be toggled per event later.
export type EventStatus = "open" | "past";
export type IhyaaEvent = {
  id: string;
  poster: string;
  titleKey: string;
  dateKey: string;
  timeKey?: string;
  locationKey: string;
  status: EventStatus;
  badgeKey?: string;
  bookHref?: string;
  isNew?: boolean;
};

export const EVENTS: IhyaaEvent[] = [];

export const OPEN_EVENTS: IhyaaEvent[] = [];
export const PAST_EVENTS: IhyaaEvent[] = [];
// Drives the navbar "new event" indicator — determined dynamically from DB events.
export const hasNewEvent = false;

// Primary navigation — intentionally minimal (Home + Events) and easy to
// extend later. `indicator: true` links surface the "new event" dot when
// `hasNewEvent` is set from the events data above.
export type NavLink = { key: string; href: string; indicator?: boolean };
export const NAV_LINKS: NavLink[] = [
  { key: "nav.home", href: "/" },
  { key: "nav.events", href: "/events", indicator: true },
  { key: "nav.gallery", href: "/gallery" },
];

// Footer keeps a richer set of jump links to the homepage sections; absolute
// hrefs so they resolve from any route.
export const FOOTER_LINKS: NavLink[] = [
  { key: "nav.home", href: "/" },
  { key: "nav.about", href: "/#about" },
  { key: "nav.activities", href: "/#activities" },
  { key: "nav.gallery", href: "/gallery" },
  { key: "nav.events", href: "/events" },
  { key: "nav.contact", href: "/#contact" },
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

export type Activity = { icon: LucideIcon; num: string; titleKey: string; descKey: string };
export const ACTIVITIES: Activity[] = [
  {
    num: "01",
    icon: Users,
    titleKey: "activities.gatherings",
    descKey: "activities.gatheringsDescription",
  },
  {
    num: "02",
    icon: Compass,
    titleKey: "activities.outings",
    descKey: "activities.outingsDescription",
  },
  {
    num: "03",
    icon: MessageCircle,
    titleKey: "activities.dialogues",
    descKey: "activities.dialoguesDescription",
  },
  {
    num: "04",
    icon: GraduationCap,
    titleKey: "activities.training",
    descKey: "activities.trainingDescription",
  },
];

export type GalleryItem = { src: string; altKey: string; w: number; h: number };
// Gallery masonry — real "moments" only.
export const GALLERY: GalleryItem[] = [
  { src: IMAGES.gathering, altKey: "gallery.altGathering", w: 590, h: 332 },
  { src: IMAGES.prayer, altKey: "gallery.altPrayer", w: 1280, h: 960 },
  { src: IMAGES.groupPortrait, altKey: "gallery.altGroup", w: 2048, h: 1516 },
  { src: IMAGES.football, altKey: "gallery.altFootball", w: 1280, h: 960 },
];

export type CardPoster = { src: string; altKey: string; w: number; h: number };
export const CARD_POSTERS: CardPoster[] = [];
