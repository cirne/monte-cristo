import { describe, it, expect } from "vitest";
import type { Character } from "./characters";

describe("lib/characters", () => {
  it("Character type has expected shape", () => {
    const c: Character = {
      id: "dantes",
      name: "Edmond Dantès",
      aliases: [],
      description: "The protagonist.",
      searchTerms: ["Dantès"],
      role: "protagonist",
    };
    expect(c.id).toBe("dantes");
    expect(c.role).toBe("protagonist");
  });
});
