import { describe, it, expect } from "vitest";
import {
  getEntityStore,
  getStoredEntity,
  slugifyEntityName,
  isFlatEntityId,
  normalizeNameForMatch,
} from "./entity-store";

describe("lib/entity-store", () => {
  describe("getEntityStore", () => {
    it("returns object with entities record", () => {
      const store = getEntityStore();
      expect(store).toHaveProperty("entities");
      expect(typeof store.entities).toBe("object");
    });
  });

  describe("getStoredEntity", () => {
    it("returns entity when found in store", () => {
      const store = getEntityStore();
      const firstId = Object.keys(store.entities)[0];
      if (firstId) {
        const entity = getStoredEntity(firstId);
        expect(entity).toBeDefined();
        expect(entity?.id).toBe(firstId);
      }
    });

    it("returns undefined for unknown id", () => {
      expect(getStoredEntity("__nonexistent__")).toBeUndefined();
    });
  });

  describe("slugifyEntityName", () => {
    it("lowercases and replaces spaces with underscores", () => {
      expect(slugifyEntityName("Edmond Dantès")).toBe("edmond_dants");
    });

    it("strips apostrophes and normalizes", () => {
      // Accented chars and apostrophes are removed; result is alphanumeric + underscore
      const result = slugifyEntityName("Château d'If");
      expect(result).toMatch(/^[a-z0-9_]+$/);
      expect(result).toContain("dif");
    });

    it("returns 'entity' for empty result", () => {
      expect(slugifyEntityName("---")).toBe("entity");
    });
  });

  describe("isFlatEntityId", () => {
    it("accepts underscore and hyphen slugs", () => {
      expect(isFlatEntityId("ogilvy")).toBe(true);
      expect(isFlatEntityId("lick-observatory")).toBe(true);
      expect(isFlatEntityId("the_narrators_wife")).toBe(true);
    });

    it("rejects type-prefixed or path-like ids", () => {
      expect(isFlatEntityId("person/ogilvy")).toBe(false);
      expect(isFlatEntityId("place/mars")).toBe(false);
      expect(isFlatEntityId("")).toBe(false);
    });
  });

  describe("normalizeNameForMatch", () => {
    it("trims and lowercases", () => {
      expect(normalizeNameForMatch("  M. de Villefort  ")).toBe("m. de villefort");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeNameForMatch("a   b")).toBe("a b");
    });
  });
});
