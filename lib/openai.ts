/**
 * OpenAI client for LLM-powered features: book indexing, character generation, images, etc.
 * Uses OPENAI_API_KEY from .env (dev time only; never commit .env).
 */

import OpenAI from "openai";
import { getOpenAIApiKey, requireOpenAIApiKey } from "./env";

let _client: OpenAI | null = null;

/** Lazy-initialized OpenAI client. Returns null if OPENAI_API_KEY is not set. */
export function getOpenAIClient(): OpenAI | null {
  const key = getOpenAIApiKey();
  if (!key?.trim()) return null;
  if (!_client) _client = new OpenAI({ apiKey: key });
  return _client;
}

/** OpenAI client; throws if OPENAI_API_KEY is not set. Use when an LLM feature is required. */
export function requireOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: requireOpenAIApiKey() });
}
