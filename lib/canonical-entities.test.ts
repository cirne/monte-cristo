import { describe, it, expect } from "vitest";
import { getCanonicalId, buildCanonicalMapping } from "./canonical-entities";
import type { StoredEntity } from "./entity-store";

describe("lib/canonical-entities", () => {
  describe("getCanonicalId", () => {
    it("returns undefined for empty id", () => {
      const store = { entities: {} as Record<string, StoredEntity> };
      expect(getCanonicalId(store, "")).toBeUndefined();
    });

    it("returns undefined when entity not in store", () => {
      const store = { entities: {} as Record<string, StoredEntity> };
      expect(getCanonicalId(store, "edmond_dants")).toBeUndefined();
    });

    it("resolves known override edmond_dants to dantes when both in store", () => {
      const store = {
        entities: {
          dantes: {
            id: "dantes",
            name: "Edmond Dantès",
            aliases: [],
            type: "person",
            firstSeenInChapter: 1,
            searchTerms: [],
          },
          edmond_dants: {
            id: "edmond_dants",
            name: "Edmond Dantès",
            aliases: [],
            type: "person",
            firstSeenInChapter: 1,
            searchTerms: [],
          },
        } as Record<string, StoredEntity>,
      };
      expect(getCanonicalId(store, "edmond_dants")).toBe("dantes");
      expect(getCanonicalId(store, "dantes")).toBe("dantes");
    });

    it("returns id when entity is only one in its name group", () => {
      const store = {
        entities: {
          dantes: {
            id: "dantes",
            name: "Edmond Dantès",
            aliases: [],
            type: "person",
            firstSeenInChapter: 1,
            searchTerms: [],
          },
        } as Record<string, StoredEntity>,
      };
      expect(getCanonicalId(store, "dantes")).toBe("dantes");
    });
  });

  describe("buildCanonicalMapping", () => {
    it("returns Map of id -> canonical id for duplicates", () => {
      const store = {
        entities: {
          dantes: {
            id: "dantes",
            name: "Edmond Dantès",
            aliases: [],
            type: "person",
            firstSeenInChapter: 1,
            searchTerms: [],
          },
          edmond_dants: {
            id: "edmond_dants",
            name: "Edmond Dantès",
            aliases: [],
            type: "person",
            firstSeenInChapter: 2,
            searchTerms: [],
          },
        } as Record<string, StoredEntity>,
      };
      const map = buildCanonicalMapping(store);
      expect(map.get("edmond_dants")).toBe("dantes");
      expect(map.has("dantes")).toBe(false);
    });

    it("returns empty Map when store has no entities", () => {
      const store = { entities: {} as Record<string, StoredEntity> };
      const map = buildCanonicalMapping(store);
      expect(map.size).toBe(0);
    });
  });
});
