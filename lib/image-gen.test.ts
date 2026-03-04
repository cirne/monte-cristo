import { describe, it, expect } from "vitest";
import {
  ContentPolicyError,
  getStylePath,
  loadStyle,
  buildFullPrompt,
} from "./image-gen";

describe("lib/image-gen", () => {
  describe("ContentPolicyError", () => {
    it("extends Error with name ContentPolicyError", () => {
      const err = new ContentPolicyError("test");
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("ContentPolicyError");
      expect(err.message).toBe("test");
    });

    it("accepts optional cause", () => {
      const cause = new Error("original");
      const err = new ContentPolicyError("wrapped", cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe("getStylePath", () => {
    it("returns path ending with data/image-style.txt", () => {
      const path = getStylePath();
      expect(path).toMatch(/data[/\\]image-style\.txt$/);
    });
  });

  describe("buildFullPrompt", () => {
    it("combines style and prompt", () => {
      const result = buildFullPrompt("A ship at sea.", "Fine art style.");
      expect(result).toContain("Fine art style.");
      expect(result).toContain("A ship at sea.");
      expect(result).toContain("Image prompt:");
    });
  });

  describe("loadStyle", () => {
    it("throws when image-style.txt does not exist", () => {
      expect(() => loadStyle("/nonexistent/path")).toThrow("Missing");
    });
  });
});
