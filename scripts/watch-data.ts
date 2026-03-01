/**
 * Watches the data/ directory and updates lib/data-manifest.ts on any change.
 * That manifest is imported by data-loading modules, so the Next dev server
 * reloads and in-memory caches (chapter-index, entity-store, book) are reset.
 *
 * Run alongside next dev, e.g.:
 *   "dev": "concurrently \"next dev --turbopack\" \"bun run scripts/watch-data.ts\""
 */

import { watch } from "fs";
import { writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const MANIFEST_PATH = join(process.cwd(), "lib", "data-manifest.ts");

function bumpManifest() {
  const content = `/**
 * Written by scripts/watch-data.ts when files in data/ change.
 * Imported by data-loading modules so the dev server reloads and caches reset.
 */
export const DATA_VERSION = ${Date.now()};
`;
  writeFileSync(MANIFEST_PATH, content, "utf-8");
  console.log("[watch-data] data/ changed → updated data-manifest.ts");
}

console.log("[watch-data] Watching data/ for changes…");
watch(DATA_DIR, { recursive: true }, (event, filename) => {
  if (filename) bumpManifest();
});
