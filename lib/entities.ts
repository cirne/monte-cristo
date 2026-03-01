/**
 * Places and events in The Count of Monte Cristo.
 * Used with characters (persons) for chapter indexing and X-Ray links.
 */

export type PlaceOrEventType = "place" | "event";

export interface PlaceOrEvent {
  id: string;
  name: string;
  type: PlaceOrEventType;
  /** Terms used to detect presence in chapter text (case-insensitive match) */
  searchTerms: string[];
  /** Short spoiler-free intro for X-Ray when shown from a chapter */
  spoilerFreeIntro?: string;
}

export const PLACES_AND_EVENTS: PlaceOrEvent[] = [
  // Places
  {
    id: "marseilles",
    name: "Marseilles",
    type: "place",
    searchTerms: ["Marseilles", "Marseille", "Phocee", "Phocea"],
    spoilerFreeIntro: "A port city in the south of France where the story opens.",
  },
  {
    id: "chateau_dif",
    name: "Château d'If",
    type: "place",
    searchTerms: ["Château d'If", "Chateau d'If", "d'If"],
    spoilerFreeIntro: "A fortress and prison on an island off Marseilles.",
  },
  {
    id: "paris",
    name: "Paris",
    type: "place",
    searchTerms: ["Paris"],
    spoilerFreeIntro: "The capital of France; much of the story later takes place here.",
  },
  {
    id: "notre_dame_garde",
    name: "Notre-Dame de la Garde",
    type: "place",
    searchTerms: ["Notre-Dame de la Garde", "la Garde"],
    spoilerFreeIntro: "A lookout point above Marseilles harbor.",
  },
  {
    id: "fort_saint_jean",
    name: "Fort Saint-Jean",
    type: "place",
    searchTerms: ["Fort Saint-Jean", "Saint-Jean"],
    spoilerFreeIntro: "A fort at the entrance to the port of Marseilles.",
  },
  {
    id: "pharaon",
    name: "Pharaon",
    type: "place",
    searchTerms: ["Pharaon"],
    spoilerFreeIntro: "The merchant ship owned by Morrel; Dantès serves as first mate.",
  },
  // Events
  {
    id: "the_revolution",
    name: "The revolution",
    type: "event",
    searchTerms: ["the revolution", "Revolution"],
    spoilerFreeIntro: "Historical upheavals in France that shape the characters' pasts.",
  },
];

export function getPlaceOrEvent(id: string): PlaceOrEvent | undefined {
  return PLACES_AND_EVENTS.find((e) => e.id === id);
}
