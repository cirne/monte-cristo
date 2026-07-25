/**
 * Orchestrate ingest of a visible-page chunk into the companion brain.
 */

import {
  appendChunkMeta,
  companionBookId,
  emptyCompanionStore,
  emptyPanelState,
  hasChunkHash,
  hashCompanionText,
  loadCompanionStore,
  rememberRecentText,
  saveCompanionStore,
  toPanelState,
  type CompanionPanelState,
} from "./companion-brain";
import { applyChunkIndexResult, indexCompanionChunk } from "./companion-chunk-index";

export interface IngestInput {
  title: string;
  text?: string;
  asin?: string | null;
  positionHint?: string | null;
  /** Optional absolute or path URL to hosted reader when locate matched. */
  hostedReaderUrl?: string | null;
}

export async function ingestCompanionChunk(input: IngestInput): Promise<CompanionPanelState> {
  const title = input.title.trim();
  if (!title) {
    return emptyPanelState("Untitled", "title-untitled", {
      message: "Missing book title.",
    });
  }

  const bookId = companionBookId(title, input.asin);
  const store = loadCompanionStore(bookId) ?? emptyCompanionStore(bookId, title, input.asin ?? undefined);
  if (title && store.bookTitle !== title) {
    // Prefer the latest non-empty title from the reader chrome.
    store.bookTitle = title;
  }
  if (input.asin && !store.asin) store.asin = input.asin;

  const text = (input.text ?? "").trim().slice(0, 4000);
  if (!text || text.length < 40) {
    saveCompanionStore(store);
    return toPanelState(store, {
      hostedReaderUrl: input.hostedReaderUrl ?? null,
      noText: true,
      message:
        "No extractable reading text on this page (common with canvas-rendered Kindle). Turn a page with selectable text, or use the local demo mock.",
    });
  }

  const hash = hashCompanionText(text);
  if (hasChunkHash(store, hash)) {
    return toPanelState(store, { hostedReaderUrl: input.hostedReaderUrl ?? null });
  }

  const nextSeq = store.maxChunkSeq + 1;
  const indexed = await indexCompanionChunk(store, text, nextSeq);
  const meta = appendChunkMeta(store, hash, indexed.currentSummary);
  applyChunkIndexResult(store, indexed, meta.seq);
  rememberRecentText(store, meta.seq, text);
  saveCompanionStore(store);

  return toPanelState(store, { hostedReaderUrl: input.hostedReaderUrl ?? null });
}

export function getCompanionState(input: {
  title: string;
  asin?: string | null;
  hostedReaderUrl?: string | null;
}): CompanionPanelState {
  const title = input.title.trim();
  if (!title) {
    return emptyPanelState("Untitled", "title-untitled", { message: "Missing book title." });
  }
  const bookId = companionBookId(title, input.asin);
  const store = loadCompanionStore(bookId);
  if (!store) {
    return emptyPanelState(title, bookId, {
      hostedReaderUrl: input.hostedReaderUrl ?? null,
      message: "No companion notes yet — open the panel while reading to index the current page.",
    });
  }
  return toPanelState(store, { hostedReaderUrl: input.hostedReaderUrl ?? null });
}
