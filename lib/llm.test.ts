import { describe, it, expect } from "vitest";
import { DEFAULT_CHAT_MODEL, defaultChatParams } from "./llm";

describe("lib/llm", () => {
  it("exports DEFAULT_CHAT_MODEL", () => {
    expect(DEFAULT_CHAT_MODEL).toBe("gpt-4.1");
  });

  it("defaultChatParams returns object with model", () => {
    const params = defaultChatParams();
    expect(params).toEqual({ model: "gpt-4.1" });
  });
});
