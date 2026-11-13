import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  RealtimeEnvelope,
  RealtimeEvent,
  RealtimeTokenResponse,
  RealtimeTransport,
} from "./types";
import { presenceChannel } from "./types";

type Subscriber = (envelope: RealtimeEnvelope) => void;

interface LocalHubState {
  seq: number;
  subscribers: Map<string, Set<Subscriber>>;
  presence: Map<string, { lastSeen: number; connections: number }>;
}

const globalHub = globalThis as typeof globalThis & {
  __ihyaaLocalSseHub?: LocalHubState;
};

function getHub(): LocalHubState {
  if (!globalHub.__ihyaaLocalSseHub) {
    globalHub.__ihyaaLocalSseHub = {
      seq: 0,
      subscribers: new Map(),
      presence: new Map(),
    };
  }
  return globalHub.__ihyaaLocalSseHub;
}

function getSigningSecret(): string {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CHAT_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("Missing AUTH_SECRET for local realtime token signing");
  }
  return secret;
}

export interface LocalTokenPayload {
  sub: string;
  ch: string[];
  exp: number;
  onl: boolean;
}

export function signLocalRealtimeToken(payload: LocalTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyLocalRealtimeToken(
  token: string,
): LocalTokenPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!encoded || !sig) return null;

  const expected = createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as LocalTokenPayload;
    if (
      !parsed ||
      typeof parsed.sub !== "string" ||
      !Array.isArray(parsed.ch) ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function subscribeLocalChannels(
  channels: string[],
  listener: Subscriber,
): () => void {
  const hub = getHub();
  for (const ch of channels) {
    let set = hub.subscribers.get(ch);
    if (!set) {
      set = new Set();
      hub.subscribers.set(ch, set);
    }
    set.add(listener);
  }

  return () => {
    for (const ch of channels) {
      const set = hub.subscribers.get(ch);
      if (!set) continue;
      set.delete(listener);
      if (set.size === 0) {
        hub.subscribers.delete(ch);
      }
    }
  };
}

export function publishLocalEvent(channel: string, event: RealtimeEvent): void {
  const hub = getHub();
  hub.seq += 1;
  const envelope: RealtimeEnvelope = {
    id: `${Date.now()}-${hub.seq}`,
    channel,
    event,
  };
  const listeners = hub.subscribers.get(channel);
  if (!listeners || listeners.size === 0) return;
  for (const listener of listeners) {
    try {
      listener(envelope);
    } catch {
      // ignore subscriber failure
    }
  }
}

const PRESENCE_TTL_MS = 45_000;

export function updateLocalPresence(
  userId: string,
  online: boolean,
  allowBroadcast: boolean,
): string[] {
  const hub = getHub();
  const now = Date.now();

  for (const [uid, entry] of hub.presence.entries()) {
    if (now - entry.lastSeen > PRESENCE_TTL_MS && entry.connections <= 0) {
      hub.presence.delete(uid);
    }
  }

  const prev = hub.presence.get(userId);
  const wasOnline = Boolean(prev && now - prev.lastSeen <= PRESENCE_TTL_MS);

  if (online && allowBroadcast) {
    hub.presence.set(userId, {
      lastSeen: now,
      connections: prev ? prev.connections : 0,
    });
    if (!wasOnline) {
      publishLocalEvent(presenceChannel(), {
        type: "presence.changed",
        userId,
        online: true,
        at: now,
      });
    }
  } else {
    hub.presence.delete(userId);
    if (wasOnline) {
      publishLocalEvent(presenceChannel(), {
        type: "presence.changed",
        userId,
        online: false,
        at: now,
      });
    }
  }

  return getLocalOnlineUserIds();
}

export function trackLocalSseConnection(
  userId: string,
  allowPresence: boolean,
): () => void {
  const hub = getHub();
  const now = Date.now();
  const current = hub.presence.get(userId);
  const wasOnline = Boolean(
    current && now - current.lastSeen <= PRESENCE_TTL_MS,
  );

  if (allowPresence) {
    hub.presence.set(userId, {
      lastSeen: now,
      connections: (current?.connections ?? 0) + 1,
    });
    if (!wasOnline) {
      publishLocalEvent(presenceChannel(), {
        type: "presence.changed",
        userId,
        online: true,
        at: now,
      });
    }
  }

  return () => {
    if (!allowPresence) return;
    const latest = hub.presence.get(userId);
    if (!latest) return;
    const remaining = Math.max(0, latest.connections - 1);
    if (remaining === 0) {
      hub.presence.delete(userId);
      publishLocalEvent(presenceChannel(), {
        type: "presence.changed",
        userId,
        online: false,
        at: Date.now(),
      });
    } else {
      hub.presence.set(userId, {
        lastSeen: Date.now(),
        connections: remaining,
      });
    }
  };
}

export function getLocalOnlineUserIds(): string[] {
  const hub = getHub();
  const now = Date.now();
  const ids: string[] = [];
  for (const [uid, entry] of hub.presence.entries()) {
    if (now - entry.lastSeen <= PRESENCE_TTL_MS || entry.connections > 0) {
      ids.push(uid);
    } else {
      hub.presence.delete(uid);
    }
  }
  return ids;
}

export const localSseTransport: RealtimeTransport = {
  kind: "local",

  async publish(channel, event) {
    publishLocalEvent(channel, event);
  },

  async issueClientToken({ userId, channels, showOnlineStatus, ttlMs }) {
    const expiresAt = Date.now() + ttlMs;
    const localToken = signLocalRealtimeToken({
      sub: userId,
      ch: channels,
      exp: expiresAt,
      onl: showOnlineStatus,
    });
    return {
      provider: "local",
      userId,
      expiresAt,
      channels,
      showOnlineStatus,
      localToken,
    } satisfies RealtimeTokenResponse;
  },
};
