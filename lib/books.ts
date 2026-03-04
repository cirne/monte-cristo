/**
 * Book registry: which books exist and their display/config.
 * Scripts and app use this to resolve slug → config (volume labels, storage key, etc.).
 */

export const BOOK_SLUGS = ["monte-cristo", "gatsby", "crime-punishment", "brothers-karamazov"] as const;
export type BookSlug = (typeof BOOK_SLUGS)[number];

export const DEFAULT_BOOK_SLUG: BookSlug = "monte-cristo";

export interface BookConfig {
  title: string;
  author: string;
  /** Single emoji for book hero/avatar (e.g. "⚓" for Monte Cristo). Optional. */
  icon?: string;
  /** Display labels for volume strings (e.g. "VOLUME ONE" → "Volume I") */
  volumeLabels?: Record<string, string>;
  /** localStorage key for last viewed chapter */
  storageKey: string;
  /** Optional baseline intro for chapter 1 (indexer) */
  baselineIntro?: string;
  /** Optional hint for scene/entity image prompts (e.g. "19th-century novel, France" or "1920s American, Jazz Age") */
  imageStyleHint?: string;
  /**
   * Optional prompt fragment injected into scene/summary explanation prompts.
   * Use for book-specific guidance (e.g. narrator name, historical context).
   */
  summaryPromptFragment?: string;
}

const CONFIG: Record<BookSlug, BookConfig> = {
  "brothers-karamazov": {
    title: "The Brothers Karamazov",
    author: "Fyodor Dostoyevsky (trans. Constance Garnett)",
    icon: "🕯️",
    storageKey: "brothers-karamazov-last-chapter",
    volumeLabels: {
      "PART I": "Part I",
      "PART II": "Part II",
      "PART III": "Part III",
      "PART IV": "Part IV",
      EPILOGUE: "Epilogue",
    },
    baselineIntro:
      "The story opens in 19th-century Russia. The following people, places, and events appear in this chapter.",
    imageStyleHint: "19th-century Russia; period attire and settings; realistic fine-art illustration.",
    summaryPromptFragment:
      "Keep in mind the setting is 19th-century Russia; avoid anachronisms and keep summaries grounded in the chapter text only.",
  },
  "crime-punishment": {
    title: "Crime and Punishment",
    author: "Fyodor Dostoyevsky (trans. Constance Garnett)",
    icon: "🪓",
    storageKey: "crime-punishment-last-chapter",
    volumeLabels: {
      "PART I": "Part I",
      "PART II": "Part II",
      "PART III": "Part III",
      "PART IV": "Part IV",
      "PART V": "Part V",
      "PART VI": "Part VI",
    },
    baselineIntro:
      "The novel opens in St. Petersburg in the 1860s. The following people, places, and events appear in this chapter.",
    imageStyleHint: "19th-century Russia, St. Petersburg; period attire and settings.",
    summaryPromptFragment:
      "Keep in mind the socio-economic conditions of 1860s St. Petersburg and Raskolnikov's internal monologue-driven narrative.",
  },
  "monte-cristo": {
    title: "The Count of Monte Cristo",
    author: "Alexandre Dumas, père",
    icon: "⚓",
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
    summaryPromptFragment:
      "Bear in mind the historical context: early 19th-century France and the Mediterranean (post-Napoleonic era); keep summaries grounded in that period and avoid anachronisms.",
  },
  gatsby: {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    icon: "💎",
    storageKey: "gatsby-last-chapter",
    volumeLabels: { Full: "The Great Gatsby" },
    baselineIntro:
      "The story is set in 1920s New York and Long Island. The following people, places, and events appear in this chapter.",
    imageStyleHint: "1920s American, Jazz Age; Long Island and New York; period-appropriate dress and setting.",
    summaryPromptFragment:
      "The narrator is Nick Carraway; refer to him by name (e.g. \"Nick\" or \"Nick's house\") rather than as \"the narrator\".",
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
