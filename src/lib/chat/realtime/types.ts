export type RealtimeProviderKind = "local" | "ably";

export type RealtimeEvent =
  | {
      type: "message.created";
      conversationId: string;
      messageId: string;
      senderId: string;
      createdAt: string;
    }
  | {
      type: "message.updated";
      conversationId: string;
      messageId: string;
      senderId: string;
      editedAt: string;
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
      type: "read";
      conversationId: string;
      userId: string;
      lastReadAt: string;
    }
  | {
      type: "member.changed";
      conversationId: string;
      action: "joined" | "left" | "removed" | "updated";
      userId?: string;
    }
  | {
      type: "friend.changed";
      kind:
        | "requested"
        | "accepted"
        | "declined"
        | "canceled"
        | "unfriended"
        | "blocked";
      actorId: string;
    }
  | {
      type: "invite.received";
      inviteId: string;
      conversationId: string;
      inviterId: string;
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
