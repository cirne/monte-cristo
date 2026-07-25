import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompanionBookStore } from "./companion-brain";

const stores = new Map<string, CompanionBookStore>();

vi.mock("./companion-brain", async () => {
  const actual = await vi.importActual<typeof import("./companion-brain")>("./companion-brain");
  return {
    ...actual,
    loadCompanionStore: (bookId: string) => {
      const stored = stores.get(bookId);
      return stored ? structuredClone(stored) : null;
    },
    saveCompanionStore: (store: CompanionBookStore) => {
      stores.set(store.bookId, structuredClone(store));
    },
  };
});

vi.mock("./companion-chunk-index", async () => {
  const actualBrain = await vi.importActual<typeof import("./companion-brain")>(
    "./companion-brain"
  );
  return {
    indexCompanionChunk: vi.fn(async () => ({
      entities: [
        {
          name: "Leto II",
          type: "person" as const,
          spoilerFreeIntro: "The God Emperor.",
        },
      ],
      currentSummary: "Leto contemplates the Golden Path.",
      storySoFar: "Leto II rules as the God Emperor.",
    })),
    applyChunkIndexResult: (
      store: CompanionBookStore,
      result: {
        entities: Array<{
          name: string;
          type: "person" | "place" | "event";
          spoilerFreeIntro?: string;
        }>;
        storySoFar: string;
      },
      chunkSeq: number
    ) => {
      for (const entity of result.entities) {
        actualBrain.mergeCompanionEntity(store, entity, chunkSeq);
      }
      store.storySoFar = result.storySoFar;
    },
  };
});

import { ingestCompanionChunk, getCompanionState } from "./companion-ingest";
import { companionBookId } from "./companion-brain";
import { indexCompanionChunk } from "./companion-chunk-index";

describe("lib/companion-ingest", () => {
  beforeEach(() => {
    stores.clear();
    vi.mocked(indexCompanionChunk).mockClear();
  });

  it("indexes a new chunk and returns panel entities", async () => {
    const title = "God Emperor of Dune Test";
    const panel = await ingestCompanionChunk({
      title,
      text: "Leto II stood upon the dune and considered the Golden Path that bound humanity.",
    });
    expect(panel.bookId).toBe(companionBookId(title));
    expect(panel.chunkCount).toBe(1);
    expect(panel.currentSummary).toContain("Golden Path");
    expect(panel.entities.some((e) => e.name === "Leto II")).toBe(true);
    expect(panel.storySoFar).toContain("God Emperor");
    expect(indexCompanionChunk).toHaveBeenCalledTimes(1);
  });

  it("dedupes identical page text", async () => {
    const title = "Dedupe Book";
    const text =
      "The same visible page text appears here with enough characters to pass the minimum length gate.";
    const first = await ingestCompanionChunk({ title, text });
    const second = await ingestCompanionChunk({ title, text });
    expect(first.chunkCount).toBe(1);
    expect(second.chunkCount).toBe(1);
    expect(indexCompanionChunk).toHaveBeenCalledTimes(1);
  });

  it("returns noText when visible text is missing", async () => {
    const panel = await ingestCompanionChunk({ title: "Canvas Book", text: "" });
    expect(panel.noText).toBe(true);
    expect(panel.chunkCount).toBe(0);
    expect(indexCompanionChunk).not.toHaveBeenCalled();
  });

  it("getCompanionState returns empty guidance before ingest", () => {
    const panel = getCompanionState({ title: "Fresh Book Never Ingested" });
    expect(panel.chunkCount).toBe(0);
    expect(panel.message).toMatch(/No companion notes/);
  });
});
