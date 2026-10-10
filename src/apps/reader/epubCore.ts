import type { CatalogBook, ReaderPreferences } from "./readerCore";

export const isEpubBook = (book: Pick<CatalogBook, "format" | "file">) =>
  book.format === "epub" || book.file.toLowerCase().endsWith(".epub");

export function encodeEpub(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
  }
  return btoa(parts.join(""));
}

export function decodeEpub(content: string) {
  return Uint8Array.from(atob(content), (character) => character.charCodeAt(0));
}

export type EpubLocation = {
  format: "epub";
  cfi: string;
  fraction: number;
  chapterTitle: string;
  href: string | null;
  excerpt: string;
};
export type EpubTocItem = { label: string; href: string; subitems?: EpubTocItem[] };
export type EpubSelection = { text: string; cfi: string; chapterTitle: string };
export type EpubSearchResult = { cfi: string; excerpt: string; label: string };
export type EpubBookmark = EpubLocation & { id: string; bookId: string; createdAt: number };
export type EpubEngine = {
  open: (options: {
    bytes: Uint8Array;
    preferences: ReaderPreferences;
    cfi?: string;
    active: boolean;
    onLocation: (location: EpubLocation) => void;
    onSelection: (selection: EpubSelection | null) => void;
    onError: (message: string) => void;
  }) => Promise<{ toc: EpubTocItem[]; fixedLayout: boolean }>;
  configure: (preferences: ReaderPreferences) => void;
  setActive: (active: boolean) => void;
  goTo: (target: string) => Promise<unknown>;
  prev: () => Promise<unknown>;
  next: () => Promise<unknown>;
  search: (query: string) => Promise<EpubSearchResult[]>;
  clearSelection: () => void;
  close: () => void;
};
