import { type NextRequest, NextResponse } from "next/server";
import {
  buildContextPrompt,
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

function buildFallbackAnswer(params: {
  sceneText: string;
  locationDescription?: string;
  characterIds?: string[];
}): string {
  const { sceneText, locationDescription, characterIds } = params;
  const location = locationDescription?.trim()
    ? `The action is currently in ${locationDescription.trim()}.`
    : "The current action is unfolding in the same immediate setting as the surrounding paragraphs.";
  const cast =
    characterIds && characterIds.length > 0
      ? ` Characters visible in the indexed scene: ${characterIds.join(", ")}.`
      : "";
  const excerpt = sceneText.replace(/\s+/g, " ").trim().slice(0, 480);
  return `${location}${cast} Up to this paragraph, the scene centers on: ${excerpt}${
    excerpt.length >= 480 ? "…" : ""
  }`;
}

export async function GET(request: NextRequest) {
  const chapterNumber = parsePositiveIntParam(request.nextUrl.searchParams.get("chapter"));
  const paragraphIndex = parseNonNegativeIntParam(request.nextUrl.searchParams.get("paragraph"));
  const maxInputTokens = parseMaxInputTokensParam(request.nextUrl.searchParams.get("maxInputTokens"));

  if (chapterNumber == null || paragraphIndex == null) {
    return NextResponse.json(
      {
        error:
          "Invalid query params. Use ?chapter=<positive int>&paragraph=<non-negative int> (optional: &maxInputTokens=40000).",
      },
      { status: 400 }
    );
  }

  try {
    const position = resolveReadingPosition(chapterNumber, paragraphIndex);
    const storySoFarBefore = getStorySoFarBeforeChapter(chapterNumber);
    const priorSceneSummaries = getSceneSummariesBeforeCurrent(position);
    const sceneText = getSceneTextUpToParagraph(position, Math.floor(maxInputTokens * 0.65));

    const context = buildContextPrompt(
      [
        { label: "Story so far before this chapter", content: storySoFarBefore },
        { label: "Earlier scenes in current chapter", content: priorSceneSummaries.join("\n") },
        {
          label: "Current scene text up to selected paragraph",
          content: sceneText,
        },
      ],
      maxInputTokens
    );

    const fallbackAnswer = buildFallbackAnswer({
      sceneText,
      locationDescription: position.scene.locationDescription,
      characterIds: position.scene.characterIds,
    });

    const { answer, source } = await generateNarrativeAnswer({
      systemPrompt: `You are a spoiler-safe literary reading companion.
Explain what is currently happening in the scene at the user's exact reading checkpoint.
Never mention events beyond the provided excerpt. Keep the explanation concrete and grounded in the text.
Return strict JSON with a single key: "answer".`,
      userPrompt: `Reading checkpoint:
- Chapter: ${chapterNumber}
- Paragraph index (0-based): ${position.paragraphIndex}
- Scene index (0-based): ${position.sceneIndex}
- Scene paragraph range: ${position.scene.startParagraph}-${position.scene.endParagraph}

Context:
${context.text}

Task:
In 4-6 sentences, explain what is going on in the current scene right now.
Emphasize immediate stakes, setting, and who appears to be involved.`,
      fallbackAnswer,
      maxOutputTokens: 420,
    });

    return NextResponse.json({
      chapterNumber,
      paragraphIndex: position.paragraphIndex,
      sceneIndex: position.sceneIndex,
      sceneRange: {
        startParagraph: position.scene.startParagraph,
        endParagraph: position.scene.endParagraph,
      },
      answer,
      answerSource: source,
      contextMeta: {
        includedSections: context.includedSections,
        estimatedInputTokens: context.estimatedInputTokens,
        sceneTextEstimatedTokens: estimateTokens(sceneText),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
