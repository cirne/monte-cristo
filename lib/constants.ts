/**
 * Constants that are safe to import on both server and client.
 */

export const TOTAL_CHAPTERS = 117;

/** localStorage key for the most recently viewed chapter number */
export const LAST_CHAPTER_STORAGE_KEY = "monte-cristo-last-chapter";

export const VOLUMES = [
  "VOLUME ONE",
  "VOLUME TWO",
  "VOLUME THREE",
  "VOLUME FOUR",
  "VOLUME FIVE",
] as const;

export const VOLUME_LABELS: Record<string, string> = {
  "VOLUME ONE": "Volume I",
  "VOLUME TWO": "Volume II",
  "VOLUME THREE": "Volume III",
  "VOLUME FOUR": "Volume IV",
  "VOLUME FIVE": "Volume V",
};
