"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeEvent } from "@/lib/chat/realtime/types";

export interface UseLiveOptions<T> {
  initialData?: T;
  enabled?: boolean;
  realtimeEnabled?: boolean;
  heartbeatMs?: number;
  refetchOnMount?: boolean;
  refetchOnReconnect?: boolean;
  refetchOnVisible?: boolean;
  onEvent?: (
    event: RealtimeEvent,
    helpers: {
      setData: React.Dispatch<React.SetStateAction<T | undefined>>;
      refresh: () => Promise<void>;
    },
  ) => boolean | void;
}

export function doesEventMatchTopics(
  event: RealtimeEvent,
  topics: string[],
): boolean {
  if (topics.length === 0) return false;
  if (topics.includes("*")) return true;

  for (const topic of topics) {
    if (topic === "events" || topic === "events:public") {
      if (event.type === "events.changed") return true;
    }
    if (topic === "bookings") {
      if (event.type === "bookings.changed") return true;
    }
    if (topic === "notifications") {
      if (
        event.type === "notification.created" ||
        event.type === "notifications.changed"
      ) {
        return true;
      }
    }
    if (topic === "friends") {
      if (event.type === "friend.changed") return true;
    }
    if (topic === "unread") {
      if (
        event.type === "unread.sync" ||
        event.type === "message.created" ||
        event.type === "friend.changed" ||
        event.type === "invite.received" ||
        event.type === "invite.updated" ||
        event.type === "member.changed"
      ) {
        return true;
      }
    }
    if (topic.startsWith("admin:")) {
      const area = topic.slice("admin:".length);
      if (event.type === "admin.changed") {
        if (area === "global" || area === "all" || event.area === area) {
          return true;
        }
      }
      if (area === "bookings" && event.type === "bookings.changed") {
        return true;
      }
      if (area === "events" && event.type === "events.changed") {
        return true;
      }
    }
    if (topic.startsWith("conv:")) {
      const convId = topic.slice("conv:".length);
      if ("conversationId" in event && event.conversationId === convId) {
        return true;
      }
    }
    if (topic.startsWith("user:")) {
      if (
        event.type === "friend.changed" ||
        event.type === "invite.received" ||
        event.type === "invite.updated" ||
        event.type === "unread.sync" ||
        event.type === "notification.created" ||
        event.type === "notifications.changed" ||
        event.type === "bookings.changed"
      ) {
        return true;
      }
    }
    if (event.type === topic) {
      return true;
    }
  }

  return false;
}

export function useLive<T>(
  key: string,
  fetcher: () => Promise<T>,
  topics: string[],
  options: UseLiveOptions<T> = {},
) {
  const {
    initialData,
    enabled = true,
    realtimeEnabled = true,
    heartbeatMs = 60_000,
    refetchOnMount = initialData === undefined,
    refetchOnReconnect = true,
    refetchOnVisible = true,
    onEvent,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(
    enabled && refetchOnMount && initialData === undefined,
  );
  const [error, setError] = useState<unknown>(null);

  const fetcherRef = useRef(fetcher);
  const topicsRef = useRef(topics);
  const onEventRef = useRef(onEvent);
  const lastFetchedAtRef = useRef<number>(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const hasInitialDataRef = useRef(initialData !== undefined);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    topicsRef.current = topics;
  }, [topics]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    mountedRef.current = true;
    if (hasInitialDataRef.current && lastFetchedAtRef.current === 0) {
      lastFetchedAtRef.current = Date.now();
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const promise = (async () => {
      try {
        const result = await fetcherRef.current();
        if (!mountedRef.current) return;
        lastFetchedAtRef.current = Date.now();
        setData(result);
        setError(null);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !refetchOnMount) return;
    void refresh();
  }, [enabled, key, refetchOnMount, refresh]);

  useEffect(() => {
    if (!enabled || !realtimeEnabled) return;
    let disposed = false;
    let releaseFn: (() => void) | undefined;
    let unsubEvents: (() => void) | undefined;
    let unsubReconnect: (() => void) | undefined;

    void import("@/lib/chat/realtime/client")
      .then(({ getChatRealtimeClient }) => {
        if (disposed) return;
        const client = getChatRealtimeClient();
        releaseFn = client.acquire();
        client.connectNow();

        unsubEvents = client.onEvent((event) => {
          if (disposed) return;
          if (!doesEventMatchTopics(event, topicsRef.current)) return;
          if (onEventRef.current) {
            const shouldRefetch = onEventRef.current(event, {
              setData,
              refresh,
            });
            if (shouldRefetch === false) return;
          }
          void refresh();
        });

        if (refetchOnReconnect) {
          unsubReconnect = client.onReconnect(() => {
            if (!disposed) {
              void refresh();
            }
          });
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unsubEvents?.();
      unsubReconnect?.();
      releaseFn?.();
    };
  }, [enabled, realtimeEnabled, refetchOnReconnect, refresh]);

  useEffect(() => {
    if (!enabled || !refetchOnVisible || typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchedAtRef.current < 3000) return;
      void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, refetchOnVisible, refresh]);

  useEffect(() => {
    if (!enabled || heartbeatMs <= 0 || typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, heartbeatMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, heartbeatMs, refresh]);

  return {
    data,
    setData,
    isLoading,
    error,
    refresh,
  };
}
