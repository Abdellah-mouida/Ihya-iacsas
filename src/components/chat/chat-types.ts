export type ChatTab = "public" | "friends" | "rooms";

export type RoomAccentToken = "main" | "brass" | "gold" | "sage";

export interface ChatUserSummary {
  id: string;
  name: string | null;
  image: string | null;
  city?: string | null;
  isOnline: boolean | null;
}

export interface ChatConversationSummary {
  id: string;
  type: "PUBLIC" | "DM" | "ROOM";
  name: string | null;
  emoji: string | null;
  accentColor: string | null;
  ownerId: string | null;
  membersCanInvite: boolean;
  memberCount: number;
  muted: boolean;
  lastReadAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  peer: {
    id: string;
    name: string | null;
    image: string | null;
    isOnline: boolean | null;
    lastReadAt: string | null;
  } | null;
  lastMessage: {
    id: string;
    senderId: string | null;
    senderName: string | null;
    type: "TEXT" | "ROOM_INVITE" | "SYSTEM";
    body: string;
    createdAt: string;
    deleted: boolean;
  } | null;
}

export interface ChatMessageItem {
  id: string;
  clientId: string | null;
  conversationId: string;
  senderId: string | null;
  sender: {
    id: string;
    name: string | null;
    image: string | null;
    isOnline: boolean | null;
  } | null;
  isAnonymized: boolean;
  type: "TEXT" | "ROOM_INVITE" | "SYSTEM";
  body: string;
  replyTo: {
    id: string;
    senderId: string | null;
    senderName: string | null;
    body: string;
    deleted: boolean;
  } | null;
  invite: {
    id: string;
    roomId: string;
    roomName: string | null;
    roomEmoji: string | null;
    roomAccentColor: string | null;
    inviterId: string;
    inviteeId: string | null;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
    expiresAt: string;
  } | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  optimisticState?: "sending" | "failed";
}

export interface FriendsDashboardState {
  friends: ChatUserSummary[];
  incomingRequests: Array<{
    friendshipId: string;
    createdAt: string;
    user: ChatUserSummary;
  }>;
  outgoingRequests: Array<{
    friendshipId: string;
    createdAt: string;
    user: ChatUserSummary;
  }>;
  blockedUsers: Array<{
    id: string;
    name: string | null;
    image: string | null;
  }>;
}

export interface RoomDetailsState {
  id: string;
  name: string;
  emoji: string | null;
  accentColor: string | null;
  ownerId: string | null;
  membersCanInvite: boolean;
  memberCap: number;
  memberCount: number;
  myRole: "OWNER" | "MEMBER";
  members: Array<{
    id: string;
    userId: string;
    name: string | null;
    image: string | null;
    role: "OWNER" | "MEMBER";
    joinedAt: string;
    isOnline: boolean | null;
  }>;
  invites: Array<{
    id: string;
    kind: "LINK" | "MESSAGE";
    inviterId: string;
    inviteeId: string | null;
    inviteeName: string | null;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
    uses: number;
    maxUses: number;
    expiresAt: string;
    createdAt: string;
  }>;
}

export interface ChatActorInfo {
  id: string;
  name: string | null;
  image: string | null;
  role: string;
  showOnlineStatus: boolean;
  chatPublicTimeoutUntil: string | null;
}

export const CURATED_CHAT_EMOJIS = [
  "🌙",
  "🕌",
  "📖",
  "🤲",
  "✨",
  "🤍",
  "🌿",
  "☀️",
  "🤝",
  "👏",
  "🙏",
  "💡",
  "🎯",
  "📌",
  "📚",
  "🗓️",
  "📍",
  "☕",
  "🌱",
  "⭐",
  "😊",
  "😄",
  "🤗",
  "❤️",
] as const;

export const ROOM_EMOJIS = ["🌙", "📖", "🕌", "🌿", "✨", "🤝", "📚", "🎯"] as const;

export const ROOM_ACCENT_STYLES: Record<
  RoomAccentToken,
  { badge: string; dot: string; ring: string }
> = {
  main: {
    badge: "bg-primary/15 text-primary border-primary/30",
    dot: "bg-primary",
    ring: "ring-primary/30",
  },
  brass: {
    badge: "bg-brass/15 text-brass border-brass/35",
    dot: "bg-brass",
    ring: "ring-brass/35",
  },
  gold: {
    badge: "bg-gold/15 text-gold-deep dark:text-gold border-gold/35",
    dot: "bg-gold",
    ring: "ring-gold/35",
  },
  sage: {
    badge: "bg-green/15 text-green border-green/30",
    dot: "bg-green",
    ring: "ring-green/30",
  },
};

export function getRoomAccentStyle(accent: string | null | undefined) {
  if (accent && accent in ROOM_ACCENT_STYLES) {
    return ROOM_ACCENT_STYLES[accent as RoomAccentToken];
  }
  return ROOM_ACCENT_STYLES.main;
}
