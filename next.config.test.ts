import { describe, it, expect } from "vitest";
import nextConfig from "./next.config";

describe("next.config", () => {
  it("exports default Next.js config", () => {
    expect(nextConfig).toBeDefined();
    expect(typeof nextConfig).toBe("object");
  });
});
