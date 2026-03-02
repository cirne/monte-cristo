import { describe, it, expect } from "vitest";
import type { PlaceOrEvent } from "./entities";

describe("lib/entities", () => {
  it("PlaceOrEvent type has expected shape", () => {
    const e: PlaceOrEvent = {
      id: "marseilles",
      name: "Marseille",
      type: "place",
      searchTerms: ["Marseille"],
    };
    expect(e.id).toBe("marseilles");
    expect(e.type).toBe("place");
  });
});
