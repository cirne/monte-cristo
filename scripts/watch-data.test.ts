import { describe, it, expect } from "vitest";

describe("scripts/watch-data", () => {
  it("module can be loaded", async () => {
    await expect(import("./watch-data")).resolves.toBeDefined();
  });
});
