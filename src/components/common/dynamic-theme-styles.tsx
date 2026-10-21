import { getCachedEnabledThemes } from "@/lib/theme-server";

export async function DynamicThemeStyles() {
  const themes = await getCachedEnabledThemes();

  // Generate CSS rules for all enabled themes
  const rules = themes.map((t) => {
    const tokenDeclarations = Object.entries(t.tokens)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");

    return `html[data-theme="${t.slug}"] {\n${tokenDeclarations}\n}`;
  }).join("\n\n");

  return (
    <style
      id="ihyaa-dynamic-themes"
      dangerouslySetInnerHTML={{ __html: rules }}
    />
  );
}
