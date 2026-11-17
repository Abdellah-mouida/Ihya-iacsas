import { ablyTransport } from "./ably";
import { localSseTransport } from "./local-sse";
import type { RealtimeProviderKind, RealtimeTransport } from "./types";

export function getRealtimeProviderKind(): RealtimeProviderKind {
  const raw = (process.env.CHAT_REALTIME_PROVIDER || "local").trim().toLowerCase();
  if (raw === "ably") return "ably";
  return "local";
}

export function getRealtimeTransport(): RealtimeTransport {
  const kind = getRealtimeProviderKind();
  if (kind === "ably") {
    return ablyTransport;
  }
  return localSseTransport;
}

export * from "./types";
export * from "./channels";
