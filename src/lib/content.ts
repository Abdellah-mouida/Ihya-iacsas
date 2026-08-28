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
  // Poster "cards" live under /images/cards/ and are surfaced in the card
  // carousel (not the gallery masonry).
  nightCard: "/images/cards/night-card.jpg",
  quoteCard: "/images/cards/quote-card.jpg",
  journeyCard: "/images/cards/journey-card.jpg",
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

export const EVENTS: IhyaaEvent[] = [
  {
    id: "majlis-ihyaa",
    poster: IMAGES.eventPoster,
    titleKey: "event.name",
    dateKey: "event.date",
    timeKey: "event.time",
    locationKey: "event.location",
    status: "open",
    badgeKey: "event.badge",
    bookHref: EVENT.bookHref,
    isNew: true,
  },
  // Placeholder archive so the page structure supports future content.
  {
    id: "past-winter-retreat",
    poster: IMAGES.groupPortrait,
    titleKey: "events.pastRetreatTitle",
    dateKey: "events.pastRetreatDate",
    locationKey: "events.pastRetreatLocation",
    status: "past",
  },
  {
    id: "past-football-cup",
    poster: IMAGES.football,
    titleKey: "events.pastCupTitle",
    dateKey: "events.pastCupDate",
    locationKey: "events.pastCupLocation",
    status: "past",
  },
  {
    id: "past-gathering",
    poster: IMAGES.gathering,
    titleKey: "events.pastGatheringTitle",
    dateKey: "events.pastGatheringDate",
    locationKey: "events.pastGatheringLocation",
    status: "past",
  },
];

export const OPEN_EVENTS = EVENTS.filter((e) => e.status === "open");
export const PAST_EVENTS = EVENTS.filter((e) => e.status === "past");
// Drives the navbar "new event" indicator — tied to the events data above.
export const hasNewEvent = OPEN_EVENTS.some((e) => e.isNew);

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

export type Branch = { id: string; nameKey: string; regionKey: string };
export const BRANCHES: Branch[] = [
  {
    id: "marrakech",
    nameKey: "branches.marrakech",
    regionKey: "branches.regionMarrakech",
  },
  {
    id: "taroudant",
    nameKey: "branches.taroudant",
    regionKey: "branches.regionTaroudant",
  },
  {
    id: "famzguid",
    nameKey: "branches.famzguid",
    regionKey: "branches.regionFamzguid",
  },
  {
    id: "ouledteima",
    nameKey: "branches.ouledteima",
    regionKey: "branches.regionOuledteima",
  },
];

export type GalleryItem = { src: string; altKey: string; w: number; h: number };
// Gallery masonry — real "moments" only. Poster cards are intentionally
// excluded here and shown in the CardCarousel section instead.
export const GALLERY: GalleryItem[] = [
  { src: IMAGES.gathering, altKey: "gallery.altGathering", w: 590, h: 332 },
  { src: IMAGES.prayer, altKey: "gallery.altPrayer", w: 1280, h: 960 },
  { src: IMAGES.groupPortrait, altKey: "gallery.altGroup", w: 2048, h: 1516 },
  { src: IMAGES.football, altKey: "gallery.altFootball", w: 1280, h: 960 },
];

// Poster "cards" for the looping card carousel (all live in /images/cards/).
export type CardPoster = { src: string; altKey: string; w: number; h: number };
export const CARD_POSTERS: CardPoster[] = [
  { src: IMAGES.nightCard, altKey: "cards.altNight", w: 512, h: 640 },
  { src: IMAGES.journeyCard, altKey: "cards.altJourney", w: 526, h: 526 },
  { src: IMAGES.quoteCard, altKey: "cards.altQuote", w: 526, h: 526 },
];
