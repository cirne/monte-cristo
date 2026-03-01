/**
 * Major characters in The Count of Monte Cristo with their aliases
 * and search terms for finding their appearances across chapters.
 */

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  /** Search terms (regex-ready strings) used to detect their presence in chapter text */
  searchTerms: string[];
  role: "protagonist" | "antagonist" | "ally" | "supporting";
}

export const CHARACTERS: Character[] = [
  {
    id: "dantes",
    name: "Edmond Dantès",
    aliases: ["The Count of Monte Cristo", "Sinbad the Sailor", "Lord Wilmore", "Abbé Busoni"],
    description:
      "The protagonist. A young sailor falsely imprisoned who escapes to find a vast treasure and exact revenge on those who betrayed him.",
    searchTerms: ["Dantès", "Dantes", "Monte Cristo", "Sinbad", "Busoni", "Wilmore", "Edmond"],
    role: "protagonist",
  },
  {
    id: "mercedes",
    name: "Mercédès",
    aliases: ["Comtesse de Morcerf"],
    description:
      "Dantès's first love, who eventually marries Fernand Mondego believing Edmond to be dead.",
    searchTerms: ["Mercédès", "Mercedes", "Comtesse de Morcerf"],
    role: "supporting",
  },
  {
    id: "fernand",
    name: "Fernand Mondego",
    aliases: ["Comte de Morcerf"],
    description:
      "Dantès's rival for Mercédès's love. One of the conspirators who had Dantès imprisoned; later becomes the Comte de Morcerf.",
    searchTerms: ["Fernand", "Morcerf"],
    role: "antagonist",
  },
  {
    id: "danglars",
    name: "Danglars",
    aliases: ["Baron Danglars"],
    description:
      "A jealous sailor aboard the Pharaon who orchestrated Dantès's arrest. Later becomes a wealthy banker.",
    searchTerms: ["Danglars"],
    role: "antagonist",
  },
  {
    id: "villefort",
    name: "M. de Villefort",
    aliases: ["de Villefort"],
    description:
      "The deputy prosecutor who condemned Dantès to prison to protect his own political ambitions.",
    searchTerms: ["Villefort"],
    role: "antagonist",
  },
  {
    id: "faria",
    name: "Abbé Faria",
    aliases: ["the abbé"],
    description:
      "An imprisoned Italian priest who befriends Dantès in the Château d'If, educates him, and reveals the location of a great treasure.",
    searchTerms: ["Faria", "abbé", "abbe"],
    role: "ally",
  },
  {
    id: "caderousse",
    name: "Gaspard Caderousse",
    aliases: [],
    description:
      "A neighbor and acquaintance of Dantès who knew of the conspiracy but did nothing to stop it.",
    searchTerms: ["Caderousse"],
    role: "supporting",
  },
  {
    id: "maximilian",
    name: "Maximilian Morrel",
    aliases: ["Maximilien"],
    description:
      "The son of Dantès's former employer, Pierre Morrel. A captain in the French Army and a man of great honor.",
    searchTerms: ["Maximilian", "Maximilien", "Morrel"],
    role: "ally",
  },
  {
    id: "valentine",
    name: "Valentine de Villefort",
    aliases: [],
    description:
      "M. de Villefort's daughter from his first marriage, loved by Maximilian Morrel.",
    searchTerms: ["Valentine"],
    role: "supporting",
  },
  {
    id: "haydee",
    name: "Haydée",
    aliases: ["Haydee"],
    description:
      "A Greek slave purchased by the Count of Monte Cristo, the daughter of Ali Pasha.",
    searchTerms: ["Haydée", "Haydee"],
    role: "ally",
  },
  {
    id: "albert",
    name: "Albert de Morcerf",
    aliases: [],
    description: "The son of Fernand Mondego and Mercédès.",
    searchTerms: ["Albert"],
    role: "supporting",
  },
  {
    id: "eugenie",
    name: "Eugénie Danglars",
    aliases: [],
    description: "Danglars's daughter, an independent young woman engaged (briefly) to Albert.",
    searchTerms: ["Eugénie", "Eugenie"],
    role: "supporting",
  },
  {
    id: "franz",
    name: "Franz d'Épinay",
    aliases: ["Franz"],
    description:
      "Albert de Morcerf's friend who first encounters the mysterious Count in Italy.",
    searchTerms: ["Franz"],
    role: "supporting",
  },
  {
    id: "bertuccio",
    name: "Bertuccio",
    aliases: [],
    description: "The Count's faithful steward with a dark past connected to Villefort.",
    searchTerms: ["Bertuccio"],
    role: "supporting",
  },
  {
    id: "madame_villefort",
    name: "Héloïse de Villefort",
    aliases: ["Madame de Villefort"],
    description:
      "Villefort's second wife, who uses poison to secure her son Édouard's inheritance.",
    searchTerms: ["Madame de Villefort", "Héloïse"],
    role: "antagonist",
  },
];

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
