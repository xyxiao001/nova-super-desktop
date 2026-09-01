import { encodedSize, type StorageProvider } from "../../platform/storage/providers/types";
import type { StoredBook } from "./readerCore";
import { getAllStoredBooks, replaceStoredBooks } from "./readerStorage";

const isStoredBook = (value: unknown): value is StoredBook => {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<StoredBook>;
  return (
    typeof book.id === "string"
    && typeof book.title === "string"
    && typeof book.author === "string"
    && typeof book.description === "string"
    && typeof book.cover === "string"
    && typeof book.file === "string"
    && typeof book.url === "string"
    && typeof book.size === "number"
    && typeof book.version === "string"
    && typeof book.content === "string"
    && typeof book.downloadedAt === "number"
    && (book.chapterIndex === undefined || Array.isArray(book.chapterIndex))
  );
};

const readerProvider: StorageProvider = {
  id: "reader",
  label: "离线书籍",
  displayOrder: 1,
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 本已下载书籍`,
  inspect: async () => {
    const books = await getAllStoredBooks();
    return { entries: books.length, bytes: books.length ? encodedSize(books) : 0 };
  },
  exportData: () => getAllStoredBooks(),
  validateData: (data) => Array.isArray(data) && data.every(isStoredBook),
  restoreData: async (data) => {
    if (!Array.isArray(data) || !data.every(isStoredBook)) {
      throw new Error("Invalid reader backup data");
    }
    await replaceStoredBooks(data);
  },
  clear: () => replaceStoredBooks([]),
};

export default readerProvider;
