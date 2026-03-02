/**
 * Book registry: which books exist and their display/config.
 * Scripts and app use this to resolve slug → config (volume labels, storage key, etc.).
 */

export const BOOK_SLUGS = ["monte-cristo", "gatsby"] as const;
export type BookSlug = (typeof BOOK_SLUGS)[number];

export const DEFAULT_BOOK_SLUG: BookSlug = "monte-cristo";

export interface BookConfig {
  title: string;
  author: string;
  /** Display labels for volume strings (e.g. "VOLUME ONE" → "Volume I") */
  volumeLabels?: Record<string, string>;
  /** localStorage key for last viewed chapter */
  storageKey: string;
  /** Optional baseline intro for chapter 1 (indexer) */
  baselineIntro?: string;
  /** Optional hint for scene/entity image prompts (e.g. "19th-century novel, France" or "1920s American, Jazz Age") */
  imageStyleHint?: string;
}

const CONFIG: Record<BookSlug, BookConfig> = {
  "monte-cristo": {
    title: "The Count of Monte Cristo",
    author: "Alexandre Dumas, père",
    storageKey: "monte-cristo-last-chapter",
    volumeLabels: {
      "VOLUME ONE": "Volume I",
      "VOLUME TWO": "Volume II",
      "VOLUME THREE": "Volume III",
      "VOLUME FOUR": "Volume IV",
      "VOLUME FIVE": "Volume V",
    },
    baselineIntro:
      "The story opens in Marseilles. The following people, places, and events appear in this chapter.",
    imageStyleHint: "19th-century novel, early 1800s France and Mediterranean; period-appropriate dress and setting.",
  },
  gatsby: {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    storageKey: "gatsby-last-chapter",
    volumeLabels: { Full: "The Great Gatsby" },
    baselineIntro:
      "The story is set in 1920s New York and Long Island. The following people, places, and events appear in this chapter.",
    imageStyleHint: "1920s American, Jazz Age; Long Island and New York; period-appropriate dress and setting.",
  },
};

export function getBookConfig(slug: string): BookConfig | undefined {
  if (BOOK_SLUGS.includes(slug as BookSlug)) {
    return CONFIG[slug as BookSlug];
  }
  return undefined;
}

export function isBookSlug(slug: string): slug is BookSlug {
  return BOOK_SLUGS.includes(slug as BookSlug);
}
