/**
 * Shared config and helpers for LLM (chat completion) usage across the app.
 * Use this for indexing, scene delineation, prompt generation, etc. to keep
 * model and defaults in one place.
 */

import type { OpenAI } from "openai";
import { requireOpenAIClient } from "./openai";

/** Default chat model for indexing, scene analysis, and prompt generation. */
export const DEFAULT_CHAT_MODEL = "gpt-4.1" as const;

/** Params to spread into chat.completions.create() so callers don't repeat model. */
export function defaultChatParams(): { model: typeof DEFAULT_CHAT_MODEL } {
  return { model: DEFAULT_CHAT_MODEL };
}

/**
 * Create a chat completion using the shared client and default model.
 * Pass only the options that vary (messages, max_tokens, response_format, etc.).
 */
export async function createChatCompletion(
  options: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "model">
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const openai = requireOpenAIClient();
  return openai.chat.completions.create({
    ...options,
    model: DEFAULT_CHAT_MODEL,
  });
}
