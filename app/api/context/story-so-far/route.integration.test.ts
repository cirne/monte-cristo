import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateChatCompletion = vi.fn();

vi.mock("@/lib/llm", () => ({
  createFastChatCompletion: (...args: unknown[]) => mockCreateChatCompletion(...args),
}));

import { GET } from "./route";

describe("app/api/context/story-so-far/route integration", () => {
  beforeEach(() => {
    mockCreateChatCompletion.mockReset();
  });

  it("builds a story-so-far prompt with checkpoint-aware context", async () => {
    mockCreateChatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              answer:
                "So far, the narrative has established key relationships and tensions, and this checkpoint sits in the middle of those developing threads.\n\nA second paragraph adds concise continuity details.\n\nA third paragraph explains how the present moment fits into prior developments.\n\nA fourth paragraph should be merged by post-processing.",
            }),
          },
        },
      ],
    });

    const request = new NextRequest(
      "http://localhost/api/context/story-so-far?chapter=1&paragraph=40&maxInputTokens=12000"
    );
    const response = await GET(request);
    const data = await response.json();
    const paragraphs = String(data.answer).split(/\n\s*\n+/);

    expect(response.status).toBe(200);
    expect(data.answerSource).toBe("llm");
    expect(data.answer).toContain("So far");
    expect(paragraphs.length).toBeLessThanOrEqual(3);
    expect(paragraphs).toHaveLength(3);
    expect(data.contextMeta.estimatedInputTokens).toBeGreaterThan(60);
    expect(data.contextMeta.includedSections).toContain("Current scene excerpt up to selected paragraph");

    expect(mockCreateChatCompletion).toHaveBeenCalledTimes(1);
    const callArg = mockCreateChatCompletion.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
      response_format?: { type: string };
    };
    expect(callArg?.response_format).toEqual({ type: "json_object" });

    const systemPrompt = callArg.messages[0]?.content ?? "";
    const userPrompt = callArg.messages[1]?.content ?? "";

    expect(systemPrompt).toContain("spoiler-safe reading companion");
    expect(userPrompt).toContain("Reading checkpoint:");
    expect(userPrompt).toContain("- Chapter: 1");
    expect(userPrompt).toContain("Context:");
    expect(userPrompt).toContain("Current scene excerpt up to selected paragraph:");
    // Non-brittle lower bound proving meaningful context inclusion.
    expect(userPrompt.length).toBeGreaterThan(500);
  });
});
