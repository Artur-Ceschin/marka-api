// The languages API content is written in. Tags match the web app's locales.
export const LOCALES = ["en", "pt-BR"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * The content language for a request, from its Accept-Language header.
 *
 * Tags are read in the order sent and q-values are ignored: browsers already
 * list languages by preference, and the web app sends a single tag. Matched on
 * the base language, so "pt", "pt-PT" and "pt-BR" all get Brazilian Portuguese
 * — the only Portuguese offered. Anything unsupported falls back to English.
 */
export function localeFrom(header: string | undefined): Locale {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";

    if (tag.startsWith("pt")) {
      return "pt-BR";
    }

    if (tag.startsWith("en")) {
      return "en";
    }
  }

  return "en";
}
