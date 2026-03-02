/**
 * Place/event types (e.g. for typed JSON or external use).
 * The app uses the entity store (StoredEntity) as the source of truth per book.
 */

export type PlaceOrEventType = "place" | "event";

export interface PlaceOrEvent {
  id: string;
  name: string;
  type: PlaceOrEventType;
  /** Terms used to detect presence in chapter text (case-insensitive match) */
  searchTerms: string[];
  /** Optional regex patterns for canonical matching */
  matchPatterns?: string[];
  /** Short spoiler-free intro for X-Ray when shown from a chapter */
  spoilerFreeIntro?: string;
}
