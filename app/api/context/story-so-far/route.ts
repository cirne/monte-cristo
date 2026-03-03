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
  getSceneSummariesBeforeCurrent,
  getSceneTextUpToParagraph,
  getStorySoFarBeforeChapter,
  resolveReadingPosition,
} from "@/lib/reading-context";
import { DEFAULT_BOOK_SLUG, getBookConfig, isBookSlug } from "@/lib/books";

function buildFallbackAnswer(params: {
  storySoFarBefore?: string;
  priorSceneSummaries: string[];
  currentSceneExcerpt: string;
  chapterNumber: number;
}): string {
  const parts: string[] = [];
  if (params.storySoFarBefore?.trim()) {
    parts.push(params.storySoFarBefore.trim());
  }
  if (params.priorSceneSummaries.length > 0) {
    parts.push(
      `Within chapter ${params.chapterNumber}, completed scenes so far: ${params.priorSceneSummaries.join(" ")}`
    );
  }
  const excerpt = params.currentSceneExcerpt.replace(/\s+/g, " ").trim().slice(0, 500);
  parts.push(
    `At the current paragraph, the immediate action in the active scene is: ${excerpt}${
      excerpt.length >= 500 ? "…" : ""
    }`
  );
  return parts.join("\n\n");
}

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
    const priorSceneSummaries = getSceneSummariesBeforeCurrent(position);
    const currentSceneExcerpt = getSceneTextUpToParagraph(position, Math.floor(maxInputTokens * 0.45));

    const context = buildContextPrompt(
      [
        { label: "Story so far before this chapter", content: storySoFarBefore },
        { label: "Completed scenes in current chapter", content: priorSceneSummaries.join("\n") },
        {
          label: "Current scene excerpt up to selected paragraph",
          content: currentSceneExcerpt,
        },
      ],
      maxInputTokens
    );

    const fallbackAnswer = buildFallbackAnswer({
      storySoFarBefore,
      priorSceneSummaries,
      currentSceneExcerpt,
      chapterNumber,
    });

    const config = getBookConfig(slug);
    const systemPromptBase = `You are a spoiler-safe reading companion for a serialized novel.
Summarize the story so far at the exact reading checkpoint and never include events beyond the provided context.
Return between one and three paragraphs (never more than three).
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
- Current scene index (0-based): ${position.sceneIndex}

Context:
${context.text}

Task:
Write a concise "story so far" recap as of this exact checkpoint.
Cover the major threads in progress and how the current moment fits into them.
Use 2-3 short paragraphs, with a hard maximum of 3 paragraphs.`,
      fallbackAnswer,
      maxOutputTokens: 620,
    });
    const formattedAnswer = coerceAnswerParagraphs(answer, { max: 3 });

    return NextResponse.json({
      chapterNumber,
      paragraphIndex: position.paragraphIndex,
      sceneIndex: position.sceneIndex,
      answer: formattedAnswer,
      answerSource: source,
      contextMeta: {
        includedSections: context.includedSections,
        estimatedInputTokens: context.estimatedInputTokens,
        currentSceneExcerptEstimatedTokens: estimateTokens(currentSceneExcerpt),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
