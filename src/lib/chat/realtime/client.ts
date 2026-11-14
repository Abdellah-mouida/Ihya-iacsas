"use client";

import type { RealtimeEnvelope, RealtimeEvent, RealtimeTokenResponse } from "./types";

type EventListener = (event: RealtimeEvent, envelope?: RealtimeEnvelope) => void;
type ReconnectListener = (info: {
  lastSeenByConv: Record<string, string>;
  sinceIso: string | null;
}) => void;
type PresenceListener = (onlineUserIds: Set<string>) => void;

class ChatRealtimeClient {
  private refCount = 0;
  private started = false;
  private destroyed = false;
  private eventListeners = new Set<EventListener>();
  private reconnectListeners = new Set<ReconnectListener>();
  private presenceListeners = new Set<PresenceListener>();
  private onlineUsers = new Set<string>();
  private lastSeenByConv = new Map<string, string>();
  private lastEventIso: string | null = null;
  private hasConnectedOnce = false;

  private eventSource: EventSource | null = null;
  private pendingEventSource: EventSource | null = null;
  private ablyClient: { close: () => void } | null = null;
  private refreshTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private idleHandle: number | null = null;
  private reconnectAttempt = 0;
  private typingLastSent = new Map<string, number>();
  private typingStopTimers = new Map<string, number>();
  private currentToken: RealtimeTokenResponse | null = null;
  private connectingPromise: Promise<void> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private pendingRefresh = false;
  private desiredConvIds: string[] = [];
  private syncOnNextReady = false;
  private recentMessageIds: string[] = [];
  private visibilityBound = false;

  acquire(): () => void {
    this.refCount += 1;
    this.destroyed = false;
    if (!this.started && !this.idleHandle) {
      this.scheduleIdleStart();
    }
    return () => {
      this.refCount = Math.max(0, this.refCount - 1);
      if (this.refCount === 0) {
        this.disconnect();
      }
    };
  }

  connectNow(): void {
    this.destroyed = false;
    if (this.idleHandle) {
      this.cancelIdle();
    }
    if (!this.started || (!this.currentToken && !this.connectingPromise)) {
      this.started = true;
      void this.connect();
    }
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  onReconnect(listener: ReconnectListener): () => void {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  onPresence(listener: PresenceListener): () => void {
    this.presenceListeners.add(listener);
    listener(new Set(this.onlineUsers));
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  getOnlineUserIds(): Set<string> {
    return new Set(this.onlineUsers);
  }

  recordMessageSeen(conversationId: string, messageId: string, createdAt?: string): void {
    this.lastSeenByConv.set(conversationId, messageId);
    if (createdAt) {
      this.lastEventIso = createdAt;
    }
  }

  async refreshSubscriptions(): Promise<void> {
    if (this.refCount <= 0 && !this.started) return;
    if (this.refreshPromise) {
      this.pendingRefresh = true;
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      do {
        this.pendingRefresh = false;
        if (this.connectingPromise) {
          await this.connectingPromise.catch(() => {});
        }
        this.syncOnNextReady = true;
        this.started = true;
        await this.connect();
        if (this.pendingRefresh && this.currentToken) {
          const subscribed = new Set(this.currentToken.channels);
          const stillMissing = this.desiredConvIds.some(
            (id) => !subscribed.has(`conv:${id}`),
          );
          if (!stillMissing) {
            this.pendingRefresh = false;
          }
        }
      } while (this.pendingRefresh && !this.destroyed);
    })().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  ensureSubscribedConversations(conversationIds: string[]): void {
    this.desiredConvIds = conversationIds;
    if (this.destroyed || this.refCount <= 0) return;
    if (this.refreshPromise) {
      return;
    }
    if (!this.currentToken) {
      if (!this.connectingPromise) {
        this.started = true;
        void this.connect();
      } else if (conversationIds.length > 0) {
        void this.connectingPromise.then(() => {
          this.ensureSubscribedConversations(this.desiredConvIds);
        });
      }
      return;
    }
    const subscribed = new Set(this.currentToken.channels);
    const missing = conversationIds.some((id) => !subscribed.has(`conv:${id}`));
    if (missing) {
      void this.refreshSubscriptions();
    }
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    if (!this.currentToken?.showOnlineStatus) return;

    const now = Date.now();
    const prevTimer = this.typingStopTimers.get(conversationId);
    if (prevTimer) {
      window.clearTimeout(prevTimer);
      this.typingStopTimers.delete(conversationId);
    }

    if (isTyping) {
      const last = this.typingLastSent.get(conversationId) ?? 0;
      if (now - last >= 1800) {
        this.typingLastSent.set(conversationId, now);
        void fetch("/api/chat/realtime/typing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, isTyping: true }),
          keepalive: true,
        }).catch(() => {});
      }

      const stopTimer = window.setTimeout(() => {
        this.typingStopTimers.delete(conversationId);
        this.typingLastSent.set(conversationId, 0);
        void fetch("/api/chat/realtime/typing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, isTyping: false }),
          keepalive: true,
        }).catch(() => {});
      }, 3000);
      this.typingStopTimers.set(conversationId, stopTimer);
    } else {
      this.typingLastSent.set(conversationId, 0);
      void fetch("/api/chat/realtime/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, isTyping: false }),
        keepalive: true,
      }).catch(() => {});
    }
  }

  private scheduleIdleStart(): void {
    if (typeof window === "undefined") return;
    const run = () => {
      this.idleHandle = null;
      if (this.destroyed || this.refCount <= 0) return;
      this.started = true;
      void this.connect();
    };

    if (typeof window.requestIdleCallback === "function") {
      this.idleHandle = window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      this.idleHandle = window.setTimeout(run, 1200);
    }
  }

  private cancelIdle(): void {
    if (typeof window === "undefined" || this.idleHandle === null) return;
    if (typeof window.cancelIdleCallback === "function") {
      try {
        window.cancelIdleCallback(this.idleHandle);
      } catch {
        window.clearTimeout(this.idleHandle);
      }
    } else {
      window.clearTimeout(this.idleHandle);
    }
    this.idleHandle = null;
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === "undefined") return;
    this.visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.started && !this.destroyed) {
        if (this.currentToken && Date.now() >= this.currentToken.expiresAt - 15_000) {
          void this.refreshSubscriptions();
        } else if (this.currentToken?.showOnlineStatus) {
          void this.sendPresenceHeartbeat(true);
        }
      }
    });
  }

  private async connect(): Promise<void> {
    if (this.connectingPromise) return this.connectingPromise;
    this.connectingPromise = this.connectInternal().finally(() => {
      this.connectingPromise = null;
    });
    return this.connectingPromise;
  }

  private async connectInternal(): Promise<void> {
    if (this.destroyed) return;
    this.bindVisibility();

    let token: RealtimeTokenResponse;
    try {
      const res = await fetch("/api/chat/realtime/token", {
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          return;
        }
        this.scheduleReconnect();
        return;
      }
      token = (await res.json()) as RealtimeTokenResponse;
    } catch {
      this.scheduleReconnect();
      return;
    }

    if (this.destroyed) return;
    this.currentToken = token;
    this.reconnectAttempt = 0;

    const refreshDelay = Math.max(30_000, token.expiresAt - Date.now() - 45_000);
    if (this.refreshTimer) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      void this.refreshSubscriptions();
    }, refreshDelay);

    if (token.provider === "ably" && token.ablyTokenRequest) {
      await this.connectAbly(token);
    } else {
      this.connectLocalSse();
    }

    this.startPresenceHeartbeat(token.showOnlineStatus);
  }

  private connectLocalSse(): void {
    if (this.pendingEventSource) {
      this.pendingEventSource.close();
      this.pendingEventSource = null;
    }
    if (this.ablyClient) {
      try {
        this.ablyClient.close();
      } catch {}
      this.ablyClient = null;
    }

    const es = new EventSource("/api/chat/realtime/stream", {
      withCredentials: true,
    });
    const hasOpenPrimary =
      this.eventSource !== null && this.eventSource.readyState !== EventSource.CLOSED;
    if (hasOpenPrimary) {
      this.pendingEventSource = es;
    } else {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.eventSource = es;
    }

    es.addEventListener("ready", (evt) => {
      if (this.destroyed) {
        es.close();
        return;
      }
      if (this.pendingEventSource === es) {
        if (this.eventSource && this.eventSource !== es) {
          this.eventSource.close();
        }
        this.eventSource = es;
        this.pendingEventSource = null;
      } else if (this.eventSource !== es) {
        es.close();
        return;
      }

      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          onlineUserIds?: string[];
        };
        if (Array.isArray(data.onlineUserIds)) {
          this.onlineUsers = new Set(data.onlineUserIds);
          this.emitPresence();
        }
      } catch {}

      if (this.hasConnectedOnce || this.syncOnNextReady) {
        this.syncOnNextReady = false;
        this.emitReconnect();
      }
      this.hasConnectedOnce = true;
    });

    es.addEventListener("message", (evt) => {
      if (this.eventSource !== es) return;
      try {
        const envelope = JSON.parse((evt as MessageEvent).data) as RealtimeEnvelope;
        if (envelope?.event) {
          this.handleIncomingEvent(envelope.event, envelope);
        }
      } catch {}
    });

    es.addEventListener("reconnect", () => {
      if (this.eventSource !== es) return;
      void this.refreshSubscriptions();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        if (this.pendingEventSource === es) {
          this.pendingEventSource = null;
        }
        if (this.eventSource === es || !this.eventSource) {
          this.scheduleReconnect();
        }
      }
    };
  }

  private async connectAbly(initialToken: RealtimeTokenResponse): Promise<void> {
    this.disconnectTransportOnly();
    const Ably = await import("ably");
    if (this.destroyed) return;

    let firstTokenUsed = false;
    const client = new Ably.Realtime({
      clientId: initialToken.userId,
      authCallback: async (_params, callback) => {
        if (!firstTokenUsed && initialToken.ablyTokenRequest) {
          firstTokenUsed = true;
          callback(null, initialToken.ablyTokenRequest as never);
          return;
        }
        try {
          const res = await fetch("/api/chat/realtime/token", {
            cache: "no-store",
          });
          if (!res.ok) {
            callback(`Token HTTP ${res.status}`, null);
            return;
          }
          const fresh = (await res.json()) as RealtimeTokenResponse;
          this.currentToken = fresh;
          callback(null, fresh.ablyTokenRequest as never);
        } catch (err) {
          callback(err instanceof Error ? err.message : "Auth failed", null);
        }
      },
    });

    this.ablyClient = client;

    client.connection.on("connected", () => {
      if (this.hasConnectedOnce) {
        this.emitReconnect();
      }
      this.hasConnectedOnce = true;
    });

    for (const chName of initialToken.channels) {
      const channel = client.channels.get(chName);
      void channel.subscribe((msg) => {
        if (msg?.data && typeof msg.data === "object") {
          this.handleIncomingEvent(msg.data as RealtimeEvent);
        }
      });

      if (chName === "presence:global") {
        if (initialToken.showOnlineStatus) {
          void channel.presence.enter({ online: true }).catch(() => {});
        }
        void channel.presence
          .get()
          .then((members) => {
            this.onlineUsers = new Set(
              members.map((m) => m.clientId).filter(Boolean),
            );
            this.emitPresence();
          })
          .catch(() => {});
        void channel.presence.subscribe((member) => {
          if (!member.clientId) return;
          if (member.action === "leave") {
            this.onlineUsers.delete(member.clientId);
          } else {
            this.onlineUsers.add(member.clientId);
          }
          this.emitPresence();
        });
      }
    }
  }

  private handleIncomingEvent(
    event: RealtimeEvent,
    envelope?: RealtimeEnvelope,
  ): void {
    if (event.type === "message.created") {
      if (this.recentMessageIds.includes(event.messageId)) {
        return;
      }
      this.recentMessageIds.push(event.messageId);
      if (this.recentMessageIds.length > 100) {
        this.recentMessageIds.shift();
      }
      this.recordMessageSeen(
        event.conversationId,
        event.messageId,
        event.createdAt,
      );
    } else if (event.type === "presence.changed") {
      if (event.online) {
        this.onlineUsers.add(event.userId);
      } else {
        this.onlineUsers.delete(event.userId);
      }
      this.emitPresence();
    }

    for (const listener of this.eventListeners) {
      try {
        listener(event, envelope);
      } catch {}
    }
  }

  private emitPresence(): void {
    const snap = new Set(this.onlineUsers);
    for (const listener of this.presenceListeners) {
      try {
        listener(snap);
      } catch {}
    }
  }

  private emitReconnect(): void {
    const lastSeenByConv = Object.fromEntries(this.lastSeenByConv.entries());
    const sinceIso = this.lastEventIso;
    for (const listener of this.reconnectListeners) {
      try {
        listener({ lastSeenByConv, sinceIso });
      } catch {}
    }
  }

  private startPresenceHeartbeat(allowOnline: boolean): void {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (!allowOnline) return;
    void this.sendPresenceHeartbeat(true);
    this.heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void this.sendPresenceHeartbeat(true);
      }
    }, 30_000);
  }

  private async sendPresenceHeartbeat(online: boolean): Promise<void> {
    try {
      const res = await fetch("/api/chat/realtime/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ online }),
        keepalive: true,
      });
      if (!res.ok) return;
      const data = (await res.json()) as { onlineUserIds?: string[] };
      if (Array.isArray(data.onlineUserIds)) {
        this.onlineUsers = new Set(data.onlineUserIds);
        this.emitPresence();
      }
    } catch {}
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.refCount <= 0) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt, 4));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed && this.refCount > 0) {
        void this.connect();
      }
    }, delay);
  }

  private disconnectTransportOnly(): void {
    if (this.pendingEventSource) {
      this.pendingEventSource.close();
      this.pendingEventSource = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.ablyClient) {
      try {
        this.ablyClient.close();
      } catch {}
      this.ablyClient = null;
    }
  }

  private disconnect(): void {
    this.destroyed = true;
    this.started = false;
    this.cancelIdle();
    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const timer of this.typingStopTimers.values()) {
      window.clearTimeout(timer);
    }
    this.typingStopTimers.clear();
    this.disconnectTransportOnly();
  }
}

let singleton: ChatRealtimeClient | null = null;

export function getChatRealtimeClient(): ChatRealtimeClient {
  if (!singleton) {
    singleton = new ChatRealtimeClient();
  }
  return singleton;
}
