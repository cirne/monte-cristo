import { describe, it, expect } from "vitest";
import { getOpenAIApiKey, requireOpenAIApiKey } from "./env";

describe("lib/env", () => {
  it("getOpenAIApiKey returns string or undefined", () => {
    const result = getOpenAIApiKey();
    expect(result === undefined || typeof result === "string").toBe(true);
  });

  it("requireOpenAIApiKey throws when OPENAI_API_KEY is empty or unset", () => {
    const orig = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";
    try {
      expect(() => requireOpenAIApiKey()).toThrow("OPENAI_API_KEY is not set");
    } finally {
      process.env.OPENAI_API_KEY = orig;
    }
  });
});
