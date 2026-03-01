/**
 * Load .env from project root so OPENAI_API_KEY (and other vars) are available
 * when running scripts (e.g. parse-book, build-chapter-index). Use at dev time
 * only; .env is never committed to the repo.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const meta = import.meta as { dir?: string };
const projectRoot = meta.dir ? join(meta.dir, "..") : process.cwd();
const envPath = join(projectRoot, ".env");

if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}
