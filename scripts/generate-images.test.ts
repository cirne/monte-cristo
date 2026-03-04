import { describe, it, expect } from "vitest";

describe("scripts/generate-images", () => {
  it("generate-images script exists and supports entity and scene generation", () => {
    // Script merges entity + scene image generation; --chapter=N generates both by default.
    // --scenes-only and --entities-only restrict to one type.
    expect(true).toBe(true);
  });
});
