import { openDB, type DBSchema } from "idb";
import type { StoredBook, StoredBookSummary } from "./readerCore";

interface ReaderDatabase extends DBSchema {
  books: { key: string; value: StoredBook };
  library: { key: string; value: StoredBookSummary };
}

const DB_NAME = "nova-reader-library";
const BOOK_STORE = "books";
const LIBRARY_STORE = "library";
const openDatabase = () => openDB<ReaderDatabase>(DB_NAME, 2, {
  upgrade(database) {
    if (!database.objectStoreNames.contains(BOOK_STORE)) database.createObjectStore(BOOK_STORE, { keyPath: "id" });
    if (!database.objectStoreNames.contains(LIBRARY_STORE)) database.createObjectStore(LIBRARY_STORE, { keyPath: "id" });
  },
});

export function summarizeStoredBook(book: StoredBook): StoredBookSummary {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    cover: book.cover,
    file: book.file,
    url: book.url,
    size: book.size,
    version: book.version,
    downloadedAt: book.downloadedAt,
    source: book.source,
    readerVersion: book.readerVersion,
  };
}

export async function getStoredBook(id: string) {
  const database = await openDatabase();
  const book = await database.get(BOOK_STORE, id);
  database.close();
  return book;
}

export async function storeBook(book: StoredBook) {
  const database = await openDatabase();
  const transaction = database.transaction([BOOK_STORE, LIBRARY_STORE], "readwrite");
  await Promise.all([
    transaction.objectStore(BOOK_STORE).put(book),
    transaction.objectStore(LIBRARY_STORE).put(summarizeStoredBook(book)),
  ]);
  await transaction.done;
  database.close();
}

export async function getStoredBookSummaries() {
  const database = await openDatabase();
  let books = await database.getAll(LIBRARY_STORE);
  if (!books.length && await database.count(BOOK_STORE)) {
    const transaction = database.transaction([BOOK_STORE, LIBRARY_STORE], "readwrite");
    let cursor = await transaction.objectStore(BOOK_STORE).openCursor();
    while (cursor) {
      await transaction.objectStore(LIBRARY_STORE).put(summarizeStoredBook(cursor.value));
      cursor = await cursor.continue();
    }
    await transaction.done;
    books = await database.getAll(LIBRARY_STORE);
  }
  database.close();
  return books;
}

export async function getAllStoredBooks() {
  const database = await openDatabase();
  const books = await database.getAll(BOOK_STORE);
  database.close();
  return books;
}

export async function replaceStoredBooks(books: StoredBook[]) {
  const database = await openDatabase();
  const transaction = database.transaction([BOOK_STORE, LIBRARY_STORE], "readwrite");
  await Promise.all([
    transaction.objectStore(BOOK_STORE).clear(),
    transaction.objectStore(LIBRARY_STORE).clear(),
  ]);
  await Promise.all(books.flatMap((book) => [
    transaction.objectStore(BOOK_STORE).put(book),
    transaction.objectStore(LIBRARY_STORE).put(summarizeStoredBook(book)),
  ]));
  await transaction.done;
  database.close();
}

export async function deleteStoredBook(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction([BOOK_STORE, LIBRARY_STORE], "readwrite");
  await Promise.all([
    transaction.objectStore(BOOK_STORE).delete(id),
    transaction.objectStore(LIBRARY_STORE).delete(id),
  ]);
  await transaction.done;
  database.close();
}
