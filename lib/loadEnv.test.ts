import { describe, it, expect } from "vitest";

describe("lib/loadEnv", () => {
  it("loadEnv module can be imported without error", async () => {
    await expect(import("./loadEnv")).resolves.toBeDefined();
  });
});
