/**
 * Progressive companion brain for arbitrary books read via Kindle (or demo).
 * Stores derived entity/summary state under data/companion/<bookId>/ — not a
 * hosted ebook copy for the Next.js reader.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { EntityType } from "./chapter-index";
import { normalizeNameForMatch, slugifyEntityName } from "./entity-store";

const COMPANION_ROOT = join(process.cwd(), "data", "companion");
const MAX_RECENT_TEXTS = 5;
const MAX_CHUNK_TEXT_CHARS = 4000;

export interface CompanionEntity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  spoilerFreeIntro?: string;
  firstSeenChunkSeq: number;
}

export interface CompanionChunkMeta {
  id: string;
  hash: string;
  seq: number;
  currentSummary?: string;
}

export interface CompanionBookStore {
  bookId: string;
  bookTitle: string;
  asin?: string;
  entities: Record<string, CompanionEntity>;
  chunks: CompanionChunkMeta[];
  maxChunkSeq: number;
  storySoFar?: string;
  /** Recent chunk texts kept for story updates (not a full-book archive). */
  recentTexts: { seq: number; text: string }[];
}

export interface CompanionPanelEntity {
  id: string;
  name: string;
  type: EntityType;
  spoilerFreeIntro?: string;
}

export interface CompanionPanelState {
  bookTitle: string;
  bookId: string;
  indexing: boolean;
  chunkCount: number;
  entities: CompanionPanelEntity[];
  currentSummary: string | null;
  storySoFar: string | null;
  hostedReaderUrl: string | null;
  noText?: boolean;
  message?: string;
}

/** Normalize a Kindle-style title for stable book ids. */
export function normalizeCompanionTitle(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable id from ASIN (preferred) or normalized title hash. */
export function companionBookId(title: string, asin?: string | null): string {
  const trimmedAsin = asin?.trim();
  if (trimmedAsin && /^[A-Z0-9]{8,12}$/i.test(trimmedAsin)) {
    return `asin-${trimmedAsin.toUpperCase()}`;
  }
  const normalized = normalizeCompanionTitle(title);
  const hash = createHash("sha256").update(normalized || "untitled").digest("hex").slice(0, 16);
  return `title-${hash}`;
}

export function hashCompanionText(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 24);
}

function storePath(bookId: string): string {
  return join(COMPANION_ROOT, bookId, "store.json");
}

export function emptyCompanionStore(
  bookId: string,
  bookTitle: string,
  asin?: string
): CompanionBookStore {
  return {
    bookId,
    bookTitle,
    asin,
    entities: {},
    chunks: [],
    maxChunkSeq: 0,
    recentTexts: [],
  };
}

export function loadCompanionStore(bookId: string): CompanionBookStore | null {
  const path = storePath(bookId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CompanionBookStore;
  } catch {
    return null;
  }
}

export function saveCompanionStore(store: CompanionBookStore): void {
  const dir = join(COMPANION_ROOT, store.bookId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(storePath(store.bookId), JSON.stringify(store, null, 2), "utf-8");
}

export function findEntityByName(
  store: CompanionBookStore,
  name: string,
  type: EntityType
): CompanionEntity | undefined {
  const norm = normalizeNameForMatch(name);
  for (const entity of Object.values(store.entities)) {
    if (entity.type !== type) continue;
    if (normalizeNameForMatch(entity.name) === norm) return entity;
    if (entity.aliases.some((a) => normalizeNameForMatch(a) === norm)) return entity;
  }
  return undefined;
}

export function mergeCompanionEntity(
  store: CompanionBookStore,
  input: {
    name: string;
    type: EntityType;
    alias?: string;
    id?: string;
    spoilerFreeIntro?: string;
  },
  chunkSeq: number
): CompanionEntity {
  const existing =
    (input.id && store.entities[input.id]) ||
    findEntityByName(store, input.name, input.type);

  if (existing) {
    if (input.alias) {
      const aliasNorm = normalizeNameForMatch(input.alias);
      if (
        aliasNorm &&
        normalizeNameForMatch(existing.name) !== aliasNorm &&
        !existing.aliases.some((a) => normalizeNameForMatch(a) === aliasNorm)
      ) {
        existing.aliases.push(input.alias.trim());
      }
    }
    if (!existing.spoilerFreeIntro && input.spoilerFreeIntro) {
      existing.spoilerFreeIntro = input.spoilerFreeIntro;
    }
    return existing;
  }

  let id = input.id?.trim() || slugifyEntityName(input.name);
  if (store.entities[id]) {
    id = `${id}_${chunkSeq}`;
  }
  const entity: CompanionEntity = {
    id,
    name: input.name.trim(),
    type: input.type,
    aliases: input.alias?.trim() ? [input.alias.trim()] : [],
    spoilerFreeIntro: input.spoilerFreeIntro,
    firstSeenChunkSeq: chunkSeq,
  };
  store.entities[id] = entity;
  return entity;
}

export function hasChunkHash(store: CompanionBookStore, hash: string): boolean {
  return store.chunks.some((c) => c.hash === hash);
}

export function appendChunkMeta(
  store: CompanionBookStore,
  hash: string,
  currentSummary?: string
): CompanionChunkMeta {
  const seq = store.maxChunkSeq + 1;
  const meta: CompanionChunkMeta = {
    id: `chunk-${seq}`,
    hash,
    seq,
    currentSummary,
  };
  store.chunks.push(meta);
  store.maxChunkSeq = seq;
  return meta;
}

export function rememberRecentText(store: CompanionBookStore, seq: number, text: string): void {
  store.recentTexts.push({ seq, text: text.slice(0, MAX_CHUNK_TEXT_CHARS) });
  if (store.recentTexts.length > MAX_RECENT_TEXTS) {
    store.recentTexts = store.recentTexts.slice(-MAX_RECENT_TEXTS);
  }
}

export function toPanelState(
  store: CompanionBookStore,
  options: {
    indexing?: boolean;
    hostedReaderUrl?: string | null;
    noText?: boolean;
    message?: string;
  } = {}
): CompanionPanelState {
  const lastChunk = store.chunks[store.chunks.length - 1];
  const entities = Object.values(store.entities)
    .filter((e) => e.firstSeenChunkSeq <= store.maxChunkSeq)
    .sort((a, b) => a.firstSeenChunkSeq - b.firstSeenChunkSeq || a.name.localeCompare(b.name))
    .map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      spoilerFreeIntro: e.spoilerFreeIntro,
    }));

  return {
    bookTitle: store.bookTitle,
    bookId: store.bookId,
    indexing: Boolean(options.indexing),
    chunkCount: store.chunks.length,
    entities,
    currentSummary: lastChunk?.currentSummary ?? null,
    storySoFar: store.storySoFar ?? null,
    hostedReaderUrl: options.hostedReaderUrl ?? null,
    noText: options.noText,
    message: options.message,
  };
}

export function emptyPanelState(
  bookTitle: string,
  bookId: string,
  extras: Partial<CompanionPanelState> = {}
): CompanionPanelState {
  return {
    bookTitle,
    bookId,
    indexing: false,
    chunkCount: 0,
    entities: [],
    currentSummary: null,
    storySoFar: null,
    hostedReaderUrl: null,
    ...extras,
  };
}
