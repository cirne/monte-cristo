import { type NextRequest, NextResponse } from "next/server";
import {
  buildContextPrompt,
  coerceAnswerParagraphs,
  generateNarrativeAnswer,
  parseMaxInputTokensParam,
  parseNonNegativeIntParam,
  parsePositiveIntParam,
} from "@/lib/context-api";
import {
  estimateTokens,
  getChapterSummaryWindowBefore,
  getChapterTextUpToParagraph,
  getSceneSummariesBeforeCurrent,
  getStorySoFarBeforeChapter,
  resolveReadingPosition,
} from "@/lib/reading-context";

function buildFallbackAnswer(params: {
  chapterNumber: number;
  priorChapterSummaries: string[];
  priorSceneSummaries: string[];
  storySoFarBefore?: string;
  chapterText: string;
}): string {
  const { chapterNumber, priorChapterSummaries, priorSceneSummaries, storySoFarBefore, chapterText } = params;
  const parts: string[] = [];
  if (storySoFarBefore?.trim()) {
    parts.push(`Story context before chapter ${chapterNumber}: ${storySoFarBefore.trim()}`);
  }
  if (priorChapterSummaries.length > 0) {
    parts.push(`Supporting context from recent chapters:\n${priorChapterSummaries.join("\n")}`);
  }
  if (priorSceneSummaries.length > 0) {
    parts.push(`Within chapter ${chapterNumber}, earlier scenes:\n${priorSceneSummaries.join("\n")}`);
  }
  const excerpt = chapterText.replace(/\s+/g, " ").trim().slice(0, 480);
  parts.push(
    `Current chapter text up to this paragraph indicates: ${excerpt}${excerpt.length >= 480 ? "…" : ""}`
  );
  return parts.join("\n\n");
}

import { DEFAULT_BOOK_SLUG, getBookConfig, isBookSlug } from "@/lib/books";

export async function GET(request: NextRequest) {
  const chapterNumber = parsePositiveIntParam(request.nextUrl.searchParams.get("chapter"));
  const paragraphIndex = parseNonNegativeIntParam(request.nextUrl.searchParams.get("paragraph"));
  const maxInputTokens = parseMaxInputTokensParam(request.nextUrl.searchParams.get("maxInputTokens"));
  const bookParam = request.nextUrl.searchParams.get("book")?.trim();
  const slug = bookParam && isBookSlug(bookParam) ? bookParam : DEFAULT_BOOK_SLUG;

  if (chapterNumber == null || paragraphIndex == null) {
    return NextResponse.json(
      {
        error:
          "Invalid query params. Use ?chapter=<positive int>&paragraph=<non-negative int> (optional: &maxInputTokens=40000, &book=<slug>).",
      },
      { status: 400 }
    );
  }

  try {
    const position = resolveReadingPosition(slug, chapterNumber, paragraphIndex);
    const storySoFarBefore = getStorySoFarBeforeChapter(slug, chapterNumber);
    const priorChapterSummaries = getChapterSummaryWindowBefore(slug, chapterNumber, 5);
    const priorSceneSummaries = getSceneSummariesBeforeCurrent(position);
    // Reserve ~50% of tokens for chapter text (can handle largest chapter ~16.5k tokens)
    // Remaining ~50% for supporting context
    const chapterText = getChapterTextUpToParagraph(position, Math.floor(maxInputTokens * 0.5));

    const context = buildContextPrompt(
      [
        {
          label: "Chapter text up to selected paragraph",
          content: chapterText,
        },
        { label: "Story so far before this chapter", content: storySoFarBefore },
        { label: "Supporting context from the last five chapters", content: priorChapterSummaries.join("\n") },
        { label: "Earlier scenes in current chapter", content: priorSceneSummaries.join("\n") },
      ],
      maxInputTokens
    );

    const fallbackAnswer = buildFallbackAnswer({
      chapterNumber,
      priorChapterSummaries,
      priorSceneSummaries,
      storySoFarBefore,
      chapterText,
    });

    const config = getBookConfig(slug);
    const systemPromptBase = `You are a spoiler-safe literary reading companion.
Summarize what has happened in this chapter so far, up to the reader's exact checkpoint.
Use recent-chapter context only as supporting background, but prioritize the chapter text provided.
Never mention events beyond the provided chapter text (the checkpoint paragraph).
Do not focus on "stakes" or "implications"—simply summarize what has happened in the chapter so far.
Naturally include location context (where events occur) along with who and when, when it helps clarify the narrative.
Write exactly two paragraphs.
Write the summary as if you are telling what happened, not describing the narrative. Avoid phrases like "In this chapter...", "So far...", "The narrative follows...", "The chapter shows...", or any other meta-commentary about the narrative itself. Just state what happened directly.
Respond with plain prose only. Do not return JSON or any structured format.`;
    const systemPrompt =
      config?.summaryPromptFragment?.trim()
        ? `${systemPromptBase}\n\nBook-specific guidance: ${config.summaryPromptFragment!.trim()}`
        : systemPromptBase;

    const { answer, source } = await generateNarrativeAnswer({
      systemPrompt,
      userPrompt: `Reading checkpoint:
- Chapter: ${chapterNumber}
- Paragraph index (0-based): ${position.paragraphIndex}

Context:
${context.text}

Summarize what has happened in this chapter so far, up to this checkpoint, in up to 2 paragraphs.`,
      fallbackAnswer,
      maxOutputTokens: 420,
    });
    const formattedAnswer = coerceAnswerParagraphs(answer, { exact: 2 });

    return NextResponse.json({
      chapterNumber,
      paragraphIndex: position.paragraphIndex,
      sceneIndex: position.sceneIndex,
      sceneRange: {
        startParagraph: position.scene.startParagraph,
        endParagraph: position.scene.endParagraph,
      },
      answer: formattedAnswer,
      answerSource: source,
      contextMeta: {
        includedSections: context.includedSections,
        estimatedInputTokens: context.estimatedInputTokens,
        chapterTextEstimatedTokens: estimateTokens(chapterText),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
