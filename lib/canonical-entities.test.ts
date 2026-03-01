import { describe, it, expect } from "vitest";
import { getCanonicalId, buildCanonicalMapping } from "./canonical-entities";
import type { StoredEntity } from "./entity-store";

describe("lib/canonical-entities", () => {
  describe("getCanonicalId", () => {
    it("returns undefined for empty id", () => {
      expect(getCanonicalId("", "person")).toBeUndefined();
    });

    it("resolves known override edmond_dants to dantes", () => {
      expect(getCanonicalId("edmond_dants", "person")).toBe("dantes");
    });

    it("returns id when character exists in curated list", () => {
      expect(getCanonicalId("dantes", "person")).toBe("dantes");
    });

    it("resolves by store entity name when type is person", () => {
      const stored: StoredEntity = {
        id: "custom_id",
        name: "Edmond Dantès",
        aliases: [],
        type: "person",
        firstSeenInChapter: 1,
        searchTerms: [],
      };
      expect(getCanonicalId("custom_id", "person", stored)).toBe("dantes");
    });
  });

  describe("buildCanonicalMapping", () => {
    it("returns Map of id -> canonical id", () => {
      const store = { entities: {} as Record<string, StoredEntity> };
      const map = buildCanonicalMapping(store);
      expect(map).toBeInstanceOf(Map);
    });
  });
});
