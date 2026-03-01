import { describe, it, expect } from "vitest";
import { CHARACTERS, getCharacter } from "./characters";

describe("lib/characters", () => {
  it("exports CHARACTERS array", () => {
    expect(Array.isArray(CHARACTERS)).toBe(true);
    expect(CHARACTERS.length).toBeGreaterThan(0);
  });

  it("each character has id, name, aliases, description, searchTerms, role", () => {
    for (const c of CHARACTERS) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("aliases");
      expect(c).toHaveProperty("description");
      expect(c).toHaveProperty("searchTerms");
      expect(c).toHaveProperty("role");
      expect(["protagonist", "antagonist", "ally", "supporting"]).toContain(c.role);
    }
  });

  it("getCharacter returns character by id", () => {
    const dantes = getCharacter("dantes");
    expect(dantes).toBeDefined();
    expect(dantes?.name).toBe("Edmond Dantès");
    expect(dantes?.role).toBe("protagonist");
  });

  it("getCharacter returns undefined for unknown id", () => {
    expect(getCharacter("unknown_char")).toBeUndefined();
  });
});
