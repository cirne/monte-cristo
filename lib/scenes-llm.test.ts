import { describe, it, expect } from "vitest";

describe("lib/scenes-llm", () => {
  it("exports getScenesFromLLM", async () => {
    const mod = await import("./scenes-llm");
    expect(typeof mod.getScenesFromLLM).toBe("function");
  });
});
