export type RealtimeProviderKind = "local" | "ably";

export interface WireEncryptedMessagePayload {
  id: string;
  clientId: string | null;
  conversationId: string;
  senderId: string | null;
  isAnonymized: boolean;
  sender: {
    id: string;
    name: string | null;
    image: string | null;
    isOnline: boolean | null;
  } | null;
  type: "TEXT" | "ROOM_INVITE" | "SYSTEM";
  ciphertext: string;
  nonce: string;
  keyVersion: number;
  keyEpoch: number;
  replyTo: {
    id: string;
    senderId: string | null;
    senderName: string | null;
    isAnonymized: boolean;
    ciphertext: string;
    nonce: string;
    keyVersion: number;
    keyEpoch: number;
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
  editedAt: string | null;
  deleted: boolean;
  createdAt: string;
}

export type RealtimeEvent =
  | {
      type: "message.created";
      conversationId: string;
      messageId: string;
      senderId: string;
      createdAt: string;
      conversationType?: "PUBLIC" | "ROOM" | "DM";
      conversationTitle?: string | null;
      wire?: WireEncryptedMessagePayload;
    }
  | {
      type: "message.updated";
      conversationId: string;
      messageId: string;
      senderId: string;
      editedAt: string;
      wire?: WireEncryptedMessagePayload;
    }
  | {
      type: "message.deleted";
      conversationId: string;
      messageId: string;
      senderId: string;
      deletedAt: string;
    }
  | {
      type: "typing";
      conversationId: string;
      userId: string;
      isTyping: boolean;
      at: number;
    }
  | {
      type: "delivered";
      conversationId: string;
      userId: string;
      lastDeliveredAt: string;
    }
  | {
      type: "read";
      conversationId: string;
      userId: string;
      lastReadAt: string;
    }
  | {
      type: "member.changed";
      conversationId: string;
      action:
        | "joined"
        | "left"
        | "removed"
        | "updated"
        | "moderation"
        | "banned"
        | "unbanned";
      userId?: string;
      keyEpoch?: number;
    }
  | {
      type: "friend.changed";
      kind:
        | "requested"
        | "accepted"
        | "declined"
        | "canceled"
        | "unfriended"
        | "blocked"
        | "unblocked";
      actorId: string;
    }
  | {
      type: "invite.received";
      inviteId: string;
      conversationId: string;
      inviterId: string;
    }
  | {
      type: "invite.updated";
      inviteId: string;
      conversationId: string;
      roomId?: string;
      messageId?: string;
      status: "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
    }
  | {
      type: "unread.sync";
      conversationId?: string;
    }
  | {
      type: "presence.changed";
      userId: string;
      online: boolean;
      at: number;
    }
  | {
      type: "notification.created";
      notificationId: string;
      notificationType: string;
      createdAt: string;
    }
  | {
      type: "notifications.changed";
      action: "read" | "unread" | "read_all" | "created";
      notificationId?: string;
      unreadCount?: number;
    }
  | {
      type: "bookings.changed";
      eventId?: string;
      bookingId?: string;
      userId?: string;
      status?: string;
    }
  | {
      type: "events.changed";
      eventId?: string;
      action: "created" | "updated" | "deleted" | "capacity";
    }
  | {
      type: "admin.changed";
      area: "bookings" | "users" | "moderation" | "settings";
      action?: string;
      targetId?: string;
    };

export interface RealtimeEnvelope {
  id: string;
  channel: string;
  event: RealtimeEvent;
}

export interface RealtimeTokenResponse {
  provider: RealtimeProviderKind;
  userId: string;
  expiresAt: number;
  channels: string[];
  showOnlineStatus: boolean;
  localToken?: string;
  ablyTokenRequest?: unknown;
}

export interface RealtimeTransport {
  readonly kind: RealtimeProviderKind;
  publish(channel: string, event: RealtimeEvent): Promise<void>;
  issueClientToken(params: {
    userId: string;
    channels: string[];
    showOnlineStatus: boolean;
    ttlMs: number;
  }): Promise<RealtimeTokenResponse>;
}

export function userChannel(userId: string): string {
  return `user:${userId}`;
}

export function conversationChannel(conversationId: string): string {
  return `conv:${conversationId}`;
}

export function presenceChannel(): string {
  return "presence:global";
}

export function eventsChannel(): string {
  return "events:public";
}

export function adminChannel(): string {
  return "admin:global";
}
