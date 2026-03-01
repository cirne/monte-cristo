/**
 * Environment config for dev time. Use .env (never committed); see .env.example.
 * OPENAI_API_KEY is used for LLM-powered indexing, character generation, images, etc.
 */

function getEnv(key: string): string | undefined {
  return process.env[key];
}

/** OpenAI API key. Set OPENAI_API_KEY in .env for LLM features (indexing, characters, images). */
export function getOpenAIApiKey(): string | undefined {
  return getEnv("OPENAI_API_KEY");
}

/** Throws if OPENAI_API_KEY is not set. Use when an LLM feature is required. */
export function requireOpenAIApiKey(): string {
  const key = getOpenAIApiKey();
  if (!key?.trim()) {
    throw new Error(
      "OPENAI_API_KEY is not set. Copy .env.example to .env and add your OpenAI API key for LLM features (indexing, characters, images)."
    );
  }
  return key;
}
