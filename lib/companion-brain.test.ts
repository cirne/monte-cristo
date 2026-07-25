import { describe, it, expect } from "vitest";
import {
  companionBookId,
  emptyCompanionStore,
  hasChunkHash,
  appendChunkMeta,
  mergeCompanionEntity,
  hashCompanionText,
  normalizeCompanionTitle,
  toPanelState,
  rememberRecentText,
} from "./companion-brain";

describe("lib/companion-brain", () => {
  it("normalizes Kindle-decorated titles", () => {
    expect(normalizeCompanionTitle("God Emperor of Dune (Kindle Edition)")).toBe(
      "god emperor of dune"
    );
  });

  it("prefers ASIN for book id", () => {
    expect(companionBookId("Anything", "B000FBFN1U")).toBe("asin-B000FBFN1U");
  });

  it("uses stable title hash when ASIN missing", () => {
    const a = companionBookId("God Emperor of Dune");
    const b = companionBookId("God Emperor of Dune (AmazonClassics Edition)");
    expect(a).toBe(b);
    expect(a.startsWith("title-")).toBe(true);
  });

  it("dedupes chunks by text hash", () => {
    const store = emptyCompanionStore("title-abc", "Test Book");
    const hash = hashCompanionText("Hello world page text");
    expect(hasChunkHash(store, hash)).toBe(false);
    appendChunkMeta(store, hash, "A summary");
    expect(hasChunkHash(store, hash)).toBe(true);
    expect(store.maxChunkSeq).toBe(1);
  });

  it("merges entities by name and keeps aliases", () => {
    const store = emptyCompanionStore("title-abc", "Test Book");
    const first = mergeCompanionEntity(
      store,
      { name: "Leto Atreides", type: "person", spoilerFreeIntro: "An emperor." },
      1
    );
    const second = mergeCompanionEntity(
      store,
      { name: "Leto Atreides", type: "person", alias: "the God Emperor" },
      2
    );
    expect(second.id).toBe(first.id);
    expect(store.entities[first.id].aliases).toContain("the God Emperor");
    expect(store.entities[first.id].spoilerFreeIntro).toBe("An emperor.");
  });

  it("builds panel state from store", () => {
    const store = emptyCompanionStore("title-abc", "Test Book");
    appendChunkMeta(store, "h1", "On this page…");
    mergeCompanionEntity(store, { name: "Arrakis", type: "place" }, 1);
    rememberRecentText(store, 1, "sand and spice");
    const panel = toPanelState(store, { hostedReaderUrl: "/book/monte-cristo" });
    expect(panel.bookTitle).toBe("Test Book");
    expect(panel.chunkCount).toBe(1);
    expect(panel.currentSummary).toBe("On this page…");
    expect(panel.entities).toHaveLength(1);
    expect(panel.hostedReaderUrl).toBe("/book/monte-cristo");
  });
});
