import { describe, it, expect } from "vitest";
import { DATA_VERSION } from "./data-manifest";

describe("lib/data-manifest", () => {
  it("exports DATA_VERSION as a number", () => {
    expect(typeof DATA_VERSION).toBe("number");
  });
});
