import { describe, it, expect } from "vitest";
import { getOpenAIClient, requireOpenAIClient } from "./openai";

describe("lib/openai", () => {
  describe("getOpenAIClient", () => {
    it("returns null when OPENAI_API_KEY is not set", () => {
      const orig = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "";
      try {
        expect(getOpenAIClient()).toBeNull();
      } finally {
        process.env.OPENAI_API_KEY = orig;
      }
    });
  });

  describe("requireOpenAIClient", () => {
    it("throws when OPENAI_API_KEY is not set", () => {
      const orig = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "";
      try {
        expect(() => requireOpenAIClient()).toThrow();
      } finally {
        process.env.OPENAI_API_KEY = orig;
      }
    });
  });
});
