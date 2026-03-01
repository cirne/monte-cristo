import { describe, it, expect } from "vitest";
import { DEFAULT_CHAT_MODEL, FAST_CHAT_MODEL, defaultChatParams, fastChatParams } from "./llm";

describe("lib/llm", () => {
  it("exports DEFAULT_CHAT_MODEL", () => {
    expect(DEFAULT_CHAT_MODEL).toBe("gpt-4.1");
  });

  it("exports FAST_CHAT_MODEL", () => {
    expect(FAST_CHAT_MODEL).toBe("gpt-4.1-mini");
  });

  it("defaultChatParams returns object with model", () => {
    const params = defaultChatParams();
    expect(params).toEqual({ model: "gpt-4.1" });
  });

  it("fastChatParams returns object with fast model", () => {
    const params = fastChatParams();
    expect(params).toEqual({ model: "gpt-4.1-mini" });
  });
});
