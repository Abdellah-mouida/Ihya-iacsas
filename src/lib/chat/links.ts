export type MessageTextSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const URL_MATCH_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const TRAILING_PUNCT_RE = /[.,!?;:)\]]+$/;

export function parseSafeMessageSegments(text: string): MessageTextSegment[] {
  if (!text) return [];
  const segments: MessageTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_MATCH_RE)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    const trailingMatch = raw.match(TRAILING_PUNCT_RE);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const candidate = trailing ? raw.slice(0, -trailing.length) : raw;

    let safeHref: string | null = null;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        safeHref = parsed.toString();
      }
    } catch {
      safeHref = null;
    }

    if (safeHref) {
      segments.push({ type: "link", value: candidate, href: safeHref });
      if (trailing) {
        segments.push({ type: "text", value: trailing });
      }
    } else {
      segments.push({ type: "text", value: raw });
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
