import Ably from "ably";
import type {
  RealtimeEvent,
  RealtimeTokenResponse,
  RealtimeTransport,
} from "./types";
import { presenceChannel } from "./types";

let restClient: Ably.Rest | null = null;

function getAblyRest(): Ably.Rest {
  const key = process.env.ABLY_API_KEY?.trim();
  if (!key) {
    throw new Error("ABLY_API_KEY is required when CHAT_REALTIME_PROVIDER=ably");
  }
  if (!restClient) {
    restClient = new Ably.Rest({ key });
  }
  return restClient;
}

export const ablyTransport: RealtimeTransport = {
  kind: "ably",

  async publish(channel: string, event: RealtimeEvent): Promise<void> {
    const rest = getAblyRest();
    await rest.channels.get(channel).publish(event.type, event);
  },

  async issueClientToken({
    userId,
    channels,
    showOnlineStatus,
    ttlMs,
  }): Promise<RealtimeTokenResponse> {
    const rest = getAblyRest();
    const capability: Record<string, ("subscribe" | "presence")[]> = {};
    const presCh = presenceChannel();

    for (const ch of channels) {
      if (ch === presCh) {
        capability[ch] = showOnlineStatus
          ? ["subscribe", "presence"]
          : ["subscribe"];
      } else {
        capability[ch] = ["subscribe"];
      }
    }

    const expiresAt = Date.now() + ttlMs;
    const ablyTokenRequest = await rest.auth.createTokenRequest({
      clientId: userId,
      ttl: ttlMs,
      capability: JSON.stringify(capability),
    });

    return {
      provider: "ably",
      userId,
      expiresAt,
      channels,
      showOnlineStatus,
      ablyTokenRequest,
    };
  },
};
