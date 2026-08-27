import {
  DEFAULT_READER_PREFERENCES,
  READER_DATA_VERSION,
  type ReaderChapter,
  type ReaderLocation,
  type ReaderPreferences,
} from "./readerCore";

const PREFERENCES_KEY = "nova-reader-preferences";
const ACTIVITY_KEY = "nova-reader-activity";
const BOOKMARKS_KEY = "nova-reader-bookmarks";
const progressKey = (bookId: string) => `nova-reader-progress:${bookId}`;
const themes = new Set(["paper", "green", "night"]);
const modes = new Set(["scroll", "page"]);
const animations = new Set(["page", "slide", "none"]);
const clamp = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, number));
};

export type ReaderActivity = Record<string, {
  bookId: string;
  lastReadAt: number;
  progress: number;
  title: string;
  author: string;
}>;

export type ReaderBookmark = {
  id: string;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  paragraphIndex: number;
  characterOffset: number;
  excerpt: string;
  createdAt: number;
};

export function readReaderPreferences(): ReaderPreferences {
  if (typeof window === "undefined") return DEFAULT_READER_PREFERENCES;
  try {
    const saved = localStorage.getItem(PREFERENCES_KEY);
    if (!saved) return DEFAULT_READER_PREFERENCES;
    const parsed = JSON.parse(saved) as { version?: number; value?: Partial<ReaderPreferences> } & Partial<ReaderPreferences>;
    const value = parsed.version === READER_DATA_VERSION && parsed.value ? parsed.value : parsed;
    return {
      theme: themes.has(value.theme ?? "") ? value.theme as ReaderPreferences["theme"] : DEFAULT_READER_PREFERENCES.theme,
      fontSize: clamp(value.fontSize, 15, 30, DEFAULT_READER_PREFERENCES.fontSize),
      lineHeight: clamp(value.lineHeight, 1.5, 2.3, DEFAULT_READER_PREFERENCES.lineHeight),
      readingMode: modes.has(value.readingMode ?? "") ? value.readingMode as ReaderPreferences["readingMode"] : DEFAULT_READER_PREFERENCES.readingMode,
      animation: animations.has(value.animation ?? "") ? value.animation as ReaderPreferences["animation"] : DEFAULT_READER_PREFERENCES.animation,
    };
  } catch {
    localStorage.removeItem(PREFERENCES_KEY);
    return DEFAULT_READER_PREFERENCES;
  }
}

export function saveReaderPreferences(preferences: ReaderPreferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    version: READER_DATA_VERSION,
    value: preferences,
  }));
}

export function readReaderLocation(bookId: string, chapters: ReaderChapter[]): ReaderLocation {
  const fallbackChapter = chapters[0];
  const fallback: ReaderLocation = {
    version: READER_DATA_VERSION,
    chapterId: fallbackChapter?.id ?? "chapter:0",
    chapterIndex: 0,
    paragraphIndex: 0,
    characterOffset: 0,
    pageIndex: 0,
    scrollProgress: 0,
    updatedAt: Date.now(),
  };
  try {
    const saved = localStorage.getItem(progressKey(bookId));
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<ReaderLocation>;
    const legacyIndex = Math.round(clamp(parsed.chapterIndex, 0, Math.max(0, chapters.length - 1), 0));
    const idIndex = parsed.version === READER_DATA_VERSION ? chapters.findIndex((chapter) => chapter.id === parsed.chapterId) : -1;
    const chapterIndex = idIndex >= 0 ? idIndex : legacyIndex;
    return {
      version: READER_DATA_VERSION,
      chapterId: chapters[chapterIndex]?.id ?? fallback.chapterId,
      chapterIndex,
      paragraphIndex: Math.round(clamp(parsed.paragraphIndex, 0, Number.MAX_SAFE_INTEGER, 0)),
      characterOffset: Math.round(clamp(parsed.characterOffset, 0, Number.MAX_SAFE_INTEGER, 0)),
      pageIndex: Math.round(clamp(parsed.pageIndex, 0, Number.MAX_SAFE_INTEGER, 0)),
      scrollProgress: clamp(parsed.scrollProgress, 0, 1, 0),
      updatedAt: clamp(parsed.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
    };
  } catch {
    localStorage.removeItem(progressKey(bookId));
    return fallback;
  }
}

export function saveReaderLocation(bookId: string, location: ReaderLocation) {
  localStorage.setItem(progressKey(bookId), JSON.stringify({
    ...location,
    version: READER_DATA_VERSION,
    updatedAt: Date.now(),
  }));
}

export function removeReaderLocation(bookId: string) {
  localStorage.removeItem(progressKey(bookId));
}

export function readReaderActivity(): ReaderActivity {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(ACTIVITY_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved) as { version?: number; value?: ReaderActivity };
    return parsed.version === READER_DATA_VERSION && parsed.value ? parsed.value : {};
  } catch {
    localStorage.removeItem(ACTIVITY_KEY);
    return {};
  }
}

export function saveReaderActivity(entry: ReaderActivity[string]) {
  const activity = readReaderActivity();
  activity[entry.bookId] = entry;
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify({ version: READER_DATA_VERSION, value: activity }));
  return activity;
}

export function readReaderBookmarks(bookId: string) {
  try {
    const saved = localStorage.getItem(BOOKMARKS_KEY);
    if (!saved) return [] as ReaderBookmark[];
    const parsed = JSON.parse(saved) as { version?: number; value?: Record<string, ReaderBookmark[]> };
    return parsed.version === READER_DATA_VERSION ? parsed.value?.[bookId] ?? [] : [];
  } catch {
    localStorage.removeItem(BOOKMARKS_KEY);
    return [] as ReaderBookmark[];
  }
}

export function saveReaderBookmarks(bookId: string, bookmarks: ReaderBookmark[]) {
  let value: Record<string, ReaderBookmark[]> = {};
  try {
    const saved = localStorage.getItem(BOOKMARKS_KEY);
    if (saved) value = (JSON.parse(saved) as { version?: number; value?: Record<string, ReaderBookmark[]> }).value ?? {};
  } catch {
    value = {};
  }
  value[bookId] = bookmarks;
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify({ version: READER_DATA_VERSION, value }));
}

export function removeReaderBookData(bookId: string) {
  removeReaderLocation(bookId);
  const activity = readReaderActivity();
  delete activity[bookId];
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify({ version: READER_DATA_VERSION, value: activity }));
  const bookmarks = readReaderBookmarks(bookId);
  if (bookmarks.length) saveReaderBookmarks(bookId, []);
}
