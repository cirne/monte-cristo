/**
 * Major characters in The Count of Monte Cristo with their aliases
 * and search terms for finding their appearances across chapters.
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

export const CHARACTERS: Character[] = [
  {
    id: "dantes",
    name: "Edmond Dantès",
    aliases: ["The Count of Monte Cristo", "Sinbad the Sailor", "Lord Wilmore", "Abbé Busoni"],
    description:
      "The protagonist. A young sailor falsely imprisoned who escapes to find a vast treasure and exact revenge on those who betrayed him.",
    spoilerFreeIntro: "A young sailor, first mate of the Pharaon.",
    searchTerms: ["Dantès", "Dantes", "Monte Cristo", "Sinbad", "Busoni", "Wilmore", "Edmond"],
    matchPatterns: ["(?:Edmond\\s+)?Dant[eè]s", "Monte\\s+Cristo", "Sinbad(?:\\s+the\\s+Sailor)?", "Abb[eé]\\s+Busoni", "Lord\\s+Wilmore"],
    role: "protagonist",
  },
  {
    id: "mercedes",
    name: "Mercédès",
    aliases: ["Comtesse de Morcerf"],
    description:
      "Dantès's first love, who eventually marries Fernand Mondego believing Edmond to be dead.",
    spoilerFreeIntro: "Dantès's beloved, from the Catalan quarter of Marseilles.",
    searchTerms: ["Mercédès", "Mercedes", "Comtesse de Morcerf"],
    matchPatterns: ["Merc[eé]d[eè]s", "Comtesse\\s+de\\s+Morcerf"],
    role: "supporting",
  },
  {
    id: "fernand",
    name: "Fernand Mondego",
    aliases: ["Comte de Morcerf"],
    description:
      "Dantès's rival for Mercédès's love. One of the conspirators who had Dantès imprisoned; later becomes the Comte de Morcerf.",
    spoilerFreeIntro: "A Catalan fisherman; rival for Mercédès's affection.",
    searchTerms: ["Fernand", "Morcerf"],
    matchPatterns: ["Fernand(?:\\s+Mondego)?", "Comte\\s+de\\s+Morcerf", "Morcerf"],
    role: "antagonist",
  },
  {
    id: "danglars",
    name: "Danglars",
    aliases: ["Baron Danglars"],
    description:
      "A jealous sailor aboard the Pharaon who orchestrated Dantès's arrest. Later becomes a wealthy banker.",
    spoilerFreeIntro: "A sailor aboard the Pharaon.",
    searchTerms: ["Danglars"],
    matchPatterns: ["M\\.?\\s*Danglars", "Monsieur\\s+Danglars", "Baron\\s+Danglars", "Danglars"],
    role: "antagonist",
  },
  {
    id: "villefort",
    name: "M. de Villefort",
    aliases: ["de Villefort"],
    description:
      "The deputy prosecutor who condemned Dantès to prison to protect his own political ambitions.",
    spoilerFreeIntro: "The deputy prosecutor in Marseilles.",
    searchTerms: ["Villefort"],
    matchPatterns: ["M\\.?\\s*de\\s+Villefort", "Villefort", "de\\s+Villefort"],
    role: "antagonist",
  },
  {
    id: "faria",
    name: "Abbé Faria",
    aliases: ["the abbé"],
    description:
      "An imprisoned Italian priest who befriends Dantès in the Château d'If, educates him, and reveals the location of a great treasure.",
    spoilerFreeIntro: "An imprisoned Italian priest known as the abbé.",
    searchTerms: ["Faria", "abbé", "abbe"],
    matchPatterns: ["Abb[eé]\\s+Faria", "Faria", "(?:the\\s+)?abb[eé]"],
    role: "ally",
  },
  {
    id: "caderousse",
    name: "Gaspard Caderousse",
    aliases: [],
    description:
      "A neighbor and acquaintance of Dantès who knew of the conspiracy but did nothing to stop it.",
    spoilerFreeIntro: "A neighbor and acquaintance of Dantès.",
    searchTerms: ["Caderousse"],
    role: "supporting",
  },
  {
    id: "maximilian",
    name: "Maximilian Morrel",
    aliases: ["Maximilien"],
    description:
      "The son of Dantès's former employer, Pierre Morrel. A captain in the French Army and a man of great honor.",
    spoilerFreeIntro: "Son of Dantès's former employer, Pierre Morrel.",
    searchTerms: ["Maximilian", "Maximilien"],
    matchPatterns: ["Maximili(?:an|en)(?:\\s+Morrel)?", "Maximilian\\s+Morrel"],
    role: "ally",
  },
  {
    id: "valentine",
    name: "Valentine de Villefort",
    aliases: [],
    description:
      "M. de Villefort's daughter from his first marriage, loved by Maximilian Morrel.",
    spoilerFreeIntro: "M. de Villefort's daughter.",
    searchTerms: ["Valentine"],
    role: "supporting",
  },
  {
    id: "haydee",
    name: "Haydée",
    aliases: ["Haydee"],
    description:
      "A Greek slave purchased by the Count of Monte Cristo, the daughter of Ali Pasha.",
    spoilerFreeIntro: "A young woman in the Count's household.",
    searchTerms: ["Haydée", "Haydee"],
    role: "ally",
  },
  {
    id: "albert",
    name: "Albert de Morcerf",
    aliases: [],
    description: "The son of Fernand Mondego and Mercédès.",
    spoilerFreeIntro: "The son of the Comte and Comtesse de Morcerf.",
    searchTerms: ["Albert"],
    role: "supporting",
  },
  {
    id: "eugenie",
    name: "Eugénie Danglars",
    aliases: [],
    description: "Danglars's daughter, an independent young woman engaged (briefly) to Albert.",
    spoilerFreeIntro: "Danglars's daughter.",
    searchTerms: ["Eugénie", "Eugenie"],
    role: "supporting",
  },
  {
    id: "franz",
    name: "Franz d'Épinay",
    aliases: ["Franz"],
    description:
      "Albert de Morcerf's friend who first encounters the mysterious Count in Italy.",
    spoilerFreeIntro: "Albert de Morcerf's friend.",
    searchTerms: ["Franz"],
    role: "supporting",
  },
  {
    id: "bertuccio",
    name: "Bertuccio",
    aliases: [],
    description: "The Count's faithful steward with a dark past connected to Villefort.",
    spoilerFreeIntro: "The Count's steward.",
    searchTerms: ["Bertuccio"],
    role: "supporting",
  },
  {
    id: "madame_villefort",
    name: "Héloïse de Villefort",
    aliases: ["Madame de Villefort"],
    description:
      "Villefort's second wife, who uses poison to secure her son Édouard's inheritance.",
    spoilerFreeIntro: "Villefort's second wife.",
    searchTerms: ["Madame de Villefort", "Héloïse"],
    role: "antagonist",
  },
];

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
