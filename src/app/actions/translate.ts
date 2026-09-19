"use server";

export async function translateText({
  text,
  from,
  to,
}: {
  text: string;
  from: "ar" | "en";
  to: "ar" | "en";
}): Promise<{ success: boolean; translation?: string; error?: string }> {
  try {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) {
      return { success: false, error: "Text too short" };
    }

    const langpair = `${from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed,
    )}&langpair=${langpair}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 3600 }, // Cache translation requests for an hour
    });

    if (!res.ok) {
      return { success: false, error: "Translation request failed" };
    }

    const data = await res.json();
    const translatedText = data?.responseData?.translatedText;

    if (
      translatedText &&
      !translatedText.startsWith("MYMEMORY WARNING:") &&
      !translatedText.includes("INVALID TARGET LANGUAGE")
    ) {
      return { success: true, translation: translatedText };
    }

    return { success: false, error: "Could not generate translation" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Translation error",
    };
  }
}
