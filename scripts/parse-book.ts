#!/usr/bin/env bun
/**
 * Entry point for parsing the book. Runs the Monte Cristo parser.
 * Writes canonical chapter HTML files and book-index metadata.
 * Use: bun run scripts/parse-book.ts
 * Or run a specific book: bun run scripts/books/monte-cristo/parse.ts
 *                          bun run scripts/books/gatsby/parse.ts
 *                          bun run scripts/books/crime-and-punishment/parse.ts
 */

import { main } from "./books/monte-cristo/parse";

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
