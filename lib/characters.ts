/**
 * Character type (e.g. for typed JSON or external use).
 * The app uses the entity store (StoredEntity) as the source of truth per book.
 */

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  /** Short spoiler-free intro for X-Ray when shown from a chapter (e.g. first appearance context) */
  spoilerFreeIntro?: string;
  /** Search terms (regex-ready strings) used to detect their presence in chapter text */
  searchTerms: string[];
  /** Optional regex patterns for matching in text (canonical + aliases). One entity can match M. Morrel, Morrel, Monsieur Morrel, etc. */
  matchPatterns?: string[];
  role: "protagonist" | "antagonist" | "ally" | "supporting";
}
