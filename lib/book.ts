import { readFileSync } from "fs";
import { join } from "path";
import "./data-manifest";
import { VOLUME_LABELS, VOLUMES } from "./constants";

export { VOLUME_LABELS, VOLUMES };

export interface ChapterSummary {
  number: number;
  title: string;
  volume: string;
}

export interface Chapter extends ChapterSummary {
  content: string;
}

export interface BookIndex {
  title: string;
  author: string;
  source: string;
  license: string;
  chapters: ChapterSummary[];
}

export interface Book extends BookIndex {
  chapters: Chapter[];
}

const DATA_DIR = join(process.cwd(), "data");

let _index: BookIndex | null = null;
let _book: Book | null = null;

export function getBookIndex(): BookIndex {
  if (!_index) {
    const raw = readFileSync(join(DATA_DIR, "book-index.json"), "utf-8");
    _index = JSON.parse(raw) as BookIndex;
  }
  return _index;
}

export function getBook(): Book {
  if (!_book) {
    const raw = readFileSync(join(DATA_DIR, "book.json"), "utf-8");
    _book = JSON.parse(raw) as Book;
  }
  return _book;
}

export function getChapter(number: number): Chapter | undefined {
  return getBook().chapters.find((c) => c.number === number);
}

