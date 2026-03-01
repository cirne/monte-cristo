import { describe, it, expect } from "vitest";
import { PLACES_AND_EVENTS, getPlaceOrEvent } from "./entities";

describe("lib/entities", () => {
  it("exports PLACES_AND_EVENTS array", () => {
    expect(Array.isArray(PLACES_AND_EVENTS)).toBe(true);
    expect(PLACES_AND_EVENTS.length).toBeGreaterThan(0);
  });

  it("each place/event has id, name, type, searchTerms", () => {
    for (const e of PLACES_AND_EVENTS) {
      expect(e).toHaveProperty("id");
      expect(e).toHaveProperty("name");
      expect(e).toHaveProperty("type");
      expect(e).toHaveProperty("searchTerms");
      expect(["place", "event"]).toContain(e.type);
    }
  });

  it("getPlaceOrEvent returns entity by id", () => {
    const marseilles = getPlaceOrEvent("marseilles");
    expect(marseilles).toBeDefined();
    expect(marseilles?.name).toBe("Marseilles");
    expect(marseilles?.type).toBe("place");
  });

  it("getPlaceOrEvent returns undefined for unknown id", () => {
    expect(getPlaceOrEvent("unknown_place")).toBeUndefined();
  });
});
