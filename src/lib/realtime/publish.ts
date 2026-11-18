import { getRealtimeTransport } from "@/lib/chat/realtime";
import type { RealtimeEvent } from "@/lib/chat/realtime/types";

/**
 * Unified server realtime publisher called after a DB mutation commits.
 * Deduplicates target topics and never throws to avoid breaking committed writes.
 */
export async function publishChange(
  topics: string | string[],
  event: RealtimeEvent,
): Promise<void> {
  const uniqueTopics = Array.from(
    new Set((Array.isArray(topics) ? topics : [topics]).filter(Boolean)),
  );
  if (uniqueTopics.length === 0) return;

  const transport = getRealtimeTransport();
  await Promise.all(
    uniqueTopics.map((topic) =>
      transport.publish(topic, event).catch((err) => {
        console.warn("[realtime] publishChange failed", {
          topic,
          type: event.type,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    ),
  );
}
