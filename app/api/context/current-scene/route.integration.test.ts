import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateChatCompletion = vi.fn();

vi.mock("@/lib/llm", () => ({
  createFastChatCompletion: (...args: unknown[]) => mockCreateChatCompletion(...args),
}));

import { GET } from "./route";

describe("app/api/context/current-scene/route integration", () => {
  beforeEach(() => {
    mockCreateChatCompletion.mockReset();
  });

  it("builds a contextual prompt from real chapter data", async () => {
    mockCreateChatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              answer:
                "The scene is currently focused on immediate onboard interactions, with social tensions and practical decisions unfolding in the same setting. Several details point to rising pressure among the people involved. The dialogue and actions suggest that choices made here will shape what comes next. Even small gestures in this moment carry weight.",
            }),
          },
        },
      ],
    });

    const request = new NextRequest(
      "http://localhost/api/context/current-scene?chapter=1&paragraph=40&maxInputTokens=12000"
    );
    const response = await GET(request);
    const data = await response.json();
    const paragraphs = String(data.answer).split(/\n\s*\n+/);

    expect(response.status).toBe(200);
    expect(data.answerSource).toBe("llm");
    expect(data.answer).toContain("scene");
    expect(paragraphs).toHaveLength(2);
    expect(data.contextMeta.estimatedInputTokens).toBeGreaterThan(60);
    expect(data.contextMeta.includedSections).toContain("Current scene text up to selected paragraph");

    expect(mockCreateChatCompletion).toHaveBeenCalledTimes(1);
    const callArg = mockCreateChatCompletion.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
      response_format?: { type: string };
    };
    expect(callArg?.response_format).toBeUndefined();

    const systemPrompt = callArg.messages[0]?.content ?? "";
    const userPrompt = callArg.messages[1]?.content ?? "";

    expect(systemPrompt).toContain("spoiler-safe literary reading companion");
    expect(userPrompt).toContain("Reading checkpoint:");
    expect(userPrompt).toContain("- Chapter: 1");
    expect(userPrompt).toContain("Context:");
    expect(userPrompt).toContain("Current scene text up to selected paragraph:");
    // Avoid brittle exact-token checks: just ensure substantial real context is present.
    expect(userPrompt.length).toBeGreaterThan(500);
  });
});
