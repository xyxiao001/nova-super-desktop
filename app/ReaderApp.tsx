"use client";

import "./reader.css";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AppLaunchIntent } from "./appLaunch";
import {
  chapterParagraphs,
  locationForOffset,
  readerExcerpt,
  READER_DATA_VERSION,
  type CatalogBook,
  type ReaderChapter,
  type ReaderLocation,
  type ReaderPreferences,
  type ReaderSearchResult,
  type ReaderTheme,
  type ReadingMode,
  type StoredBook,
  type StoredBookSummary,
} from "./readerCore";
import {
  readReaderLocation,
  readReaderPreferences,
  readReaderActivity,
  readReaderBookmarks,
  removeReaderBookData,
  saveReaderActivity,
  saveReaderBookmarks,
  saveReaderLocation,
  saveReaderPreferences,
  type ReaderActivity,
  type ReaderBookmark,
} from "./readerPersistence";
import {
  deleteStoredBook,
  getStoredBook,
  getStoredBookSummaries,
  summarizeStoredBook,
  storeBook,
} from "./readerStorage";
import {
  DESKTOP_ICON_LONG_PRESS_MS,
  isCompactDesktopViewport,
  movedBeyondLongPressTolerance,
} from "./desktopIconInteraction";
import ReaderFlipBook from "./ReaderFlipBook";
import ReaderWorker from "./reader.worker?worker";

type DownloadMetadata = Record<string, { version: string; downloadedAt: number }>;
type ReaderWorkerResult = { content: string; chapters: ReaderChapter[] };
type ReaderWorkerPayload = Partial<ReaderWorkerResult> & { results?: ReaderSearchResult[] };
type ReaderWorkerResponse = ReaderWorkerPayload & { requestId: number; error?: string };
type ShelfFilter = "all" | "downloaded" | "local" | "cloud";
type BatteryState = { level: number; charging: boolean };
type BatteryManagerLike = BatteryState & {
  addEventListener: (type: "levelchange" | "chargingchange", listener: () => void) => void;
  removeEventListener: (type: "levelchange" | "chargingchange", listener: () => void) => void;
};

const LEGACY_DOWNLOADS_KEY = "nova-reader-downloads";
const READING_ANCHOR_OFFSET = 72;
const PAGE_GAP = 48;
const timestamp = Date.now;
const hasCompactReaderViewport = () => window.matchMedia("(max-width: 900px)").matches;

const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export default function ReaderApp({
  active,
  launchIntent,
  onLaunchHandled,
  onCreateExcerpt,
}: {
  active: boolean;
  launchIntent: Extract<AppLaunchIntent, { app: "reader" }> | null;
  onLaunchHandled: (requestId: number) => void;
  onCreateExcerpt: (excerpt: { title: string; content: string }) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogBook[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [downloads, setDownloads] = useState<DownloadMetadata>({});
  const [localBooks, setLocalBooks] = useState<StoredBookSummary[]>([]);
  const [downloading, setDownloading] = useState<Set<string>>(() => new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [openingBookId, setOpeningBookId] = useState<string | null>(null);
  const [shelfQuery, setShelfQuery] = useState("");
  const [shelfFilter, setShelfFilter] = useState<ShelfFilter>("all");
  const [activity, setActivity] = useState<ReaderActivity>(readReaderActivity);
  const [storageUsage, setStorageUsage] = useState<number | null>(null);
  const [shelfEditing, setShelfEditing] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; type: "local" | "cloud" } | null>(null);
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null);
  const [chapters, setChapters] = useState<ReaderChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"chapters" | "bookmarks">("chapters");
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ReaderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [locationJumpToken, setLocationJumpToken] = useState(0);
  const [turn, setTurn] = useState<{ direction: "forward" | "back"; token: number }>({ direction: "forward", token: 0 });
  const [message, setMessage] = useState("");
  const [selectedExcerpt, setSelectedExcerpt] = useState("");
  const [preferences, setPreferences] = useState<ReaderPreferences>(readReaderPreferences);
  const [clock, setClock] = useState(() => new Date());
  const [battery, setBattery] = useState<BatteryState | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const pageViewportRef = useRef<HTMLDivElement>(null);
  const pageFlowRef = useRef<HTMLDivElement>(null);
  const pendingLastPageRef = useRef(false);
  const pagePointerRef = useRef<{ x: number; y: number } | null>(null);
  const shelfPressRef = useRef<{ id: string; x: number; y: number; timer: number } | null>(null);
  const suppressShelfOpenRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerRequestRef = useRef(0);
  const workerPendingRef = useRef(new Map<number, { resolve: (result: ReaderWorkerPayload) => void; reject: (error: Error) => void }>());
  const pendingLocationRef = useRef<ReaderLocation | null>(null);
  const semanticLocationRef = useRef({ paragraphIndex: 0, characterOffset: 0 });
  const progressSnapshotRef = useRef<{ bookId: string; location: ReaderLocation } | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const requestedBookRef = useRef<string | null>(null);
  const downloadControllersRef = useRef(new Map<string, AbortController>());
  const chromeTimerRef = useRef<number | null>(null);
  const lastLaunchRequestRef = useRef(0);

  const getReaderWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new ReaderWorker();
    worker.onmessage = (event: MessageEvent<ReaderWorkerResponse>) => {
      const pending = workerPendingRef.current.get(event.data.requestId);
      if (!pending) return;
      workerPendingRef.current.delete(event.data.requestId);
      if (event.data.error) pending.reject(new Error(event.data.error));
      else pending.resolve(event.data);
    };
    worker.onerror = () => {
      for (const pending of workerPendingRef.current.values()) pending.reject(new Error("书籍解析失败"));
      workerPendingRef.current.clear();
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  }, []);

  const processBookText = (input: { content: string } | { buffer: ArrayBuffer }) => {
    const worker = getReaderWorker();
    const requestId = ++workerRequestRef.current;
    return new Promise<ReaderWorkerResult>((resolve, reject) => {
      const handleResult = (result: ReaderWorkerPayload) => {
        if (result.content === undefined || !result.chapters) reject(new Error("书籍解析结果无效"));
        else resolve({ content: result.content, chapters: result.chapters });
      };
      workerPendingRef.current.set(requestId, { resolve: handleResult, reject });
      if ("buffer" in input) worker.postMessage({ requestId, type: "decode", buffer: input.buffer }, [input.buffer]);
      else worker.postMessage({ requestId, type: "parse", content: input.content });
    });
  };

  useEffect(() => {
    const pendingRequests = workerPendingRef.current;
    scrollFrameRef.current = null;
    return () => {
      workerRef.current?.terminate();
      for (const pending of pendingRequests.values()) pending.reject(new Error("阅读器已关闭"));
      pendingRequests.clear();
      if (progressTimerRef.current) window.clearTimeout(progressTimerRef.current);
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
      if (shelfPressRef.current) window.clearTimeout(shelfPressRef.current.timer);
      scrollFrameRef.current = null;
    };
  }, []);

  const loadCatalog = async () => {
    setCatalogState("loading");
    try {
      const response = await fetch("/books/catalog.json", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json() as { books: CatalogBook[] };
      setCatalog(data.books);
      setCatalogState("ready");
    } catch {
      setCatalogState("error");
    }
  };

  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem(LEGACY_DOWNLOADS_KEY);
    const catalogTimer = window.setTimeout(() => void loadCatalog(), 0);
    void getStoredBookSummaries().then((books) => {
      if (cancelled) return;
      setLocalBooks(books.filter((book) => book.source === "local"));
      setDownloads(Object.fromEntries(books.filter((book) => book.source !== "local").map((book) => [book.id, { version: book.version, downloadedAt: book.downloadedAt }])));
    }).catch(() => setMessage("本地书库读取失败"));
    return () => { cancelled = true; window.clearTimeout(catalogTimer); };
  }, []);

  useEffect(() => {
    saveReaderPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!activeBook) return;
    const updateClock = () => setClock(new Date());
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, [activeBook]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!activeBook) return;
    const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> }).getBattery;
    if (!getBattery) return;
    let manager: BatteryManagerLike | null = null;
    let cancelled = false;
    const update = () => {
      if (manager && !cancelled) setBattery({ level: manager.level, charging: manager.charging });
    };
    void getBattery.call(navigator).then((value) => {
      if (cancelled) return;
      manager = value;
      update();
      manager.addEventListener("levelchange", update);
      manager.addEventListener("chargingchange", update);
    }).catch(() => setBattery(null));
    return () => {
      cancelled = true;
      manager?.removeEventListener("levelchange", update);
      manager?.removeEventListener("chargingchange", update);
    };
  }, [activeBook]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const closeSidebar = () => {
      if (media.matches) setSidebarOpen(false);
    };
    closeSidebar();
    media.addEventListener("change", closeSidebar);
    return () => media.removeEventListener("change", closeSidebar);
  }, []);

  const chapter = chapters[chapterIndex];
  const followingChapter = chapters[chapterIndex + 1];
  const chapterContent = useMemo(() => activeBook && chapter ? activeBook.content.slice(chapter.start, chapter.end) : "", [activeBook, chapter]);
  const paragraphs = useMemo(() => chapter ? chapterParagraphs(activeBook?.content ?? "", chapter) : [], [activeBook, chapter]);
  const nextFlipChapter = useMemo(() => followingChapter ? {
    title: followingChapter.title,
    paragraphs: chapterParagraphs(activeBook?.content ?? "", followingChapter),
  } : null, [activeBook, followingChapter]);
  const paragraphSegments = useMemo(() => {
    const segments = [];
    for (let index = 0; index < paragraphs.length; index += 24) segments.push(paragraphs.slice(index, index + 24));
    return segments;
  }, [paragraphs]);
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageFlipEnabled = preferences.readingMode === "page" && preferences.animation === "page" && pageWidth > 0 && !reducedMotion;
  const chapterProgress = preferences.readingMode === "scroll" ? scrollProgress : (safePageIndex + 1) / pageCount;
  const completedCharacters = useMemo(() => chapters.slice(0, chapterIndex).reduce((total, item) => total + item.characterCount, 0), [chapterIndex, chapters]);
  const totalCharacters = useMemo(() => chapters.reduce((total, item) => total + item.characterCount, 0), [chapters]);
  const progress = activeBook && totalCharacters ? Math.round(((completedCharacters + (chapter?.characterCount ?? 0) * chapterProgress) / totalCharacters) * 100) : 0;

  useLayoutEffect(() => {
    if (preferences.readingMode !== "page") return;
    const viewport = pageViewportRef.current;
    if (!viewport) return;
    const measure = () => {
      if (viewport.clientWidth > 0) setPageWidth(viewport.clientWidth);
      const page = pageRef.current;
      if (page?.clientWidth && page.clientHeight) {
        setPageSize((current) => current.width === page.clientWidth && current.height === page.clientHeight
          ? current
          : { width: page.clientWidth, height: page.clientHeight });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [activeBook, chapterIndex, preferences.readingMode]);

  useLayoutEffect(() => {
    if (preferences.readingMode !== "page" || !pageWidth) return;
    const flow = pageFlowRef.current;
    if (!flow) return;
    const nextCount = Math.max(1, Math.round((flow.scrollWidth + PAGE_GAP) / (pageWidth + PAGE_GAP)));
    setPageCount((current) => {
      if (pendingLastPageRef.current) {
        pendingLastPageRef.current = false;
        setPageIndex(nextCount - 1);
      } else if (current !== nextCount) {
        const ratio = current > 1 ? safePageIndex / (current - 1) : 0;
        setPageIndex(Math.min(nextCount - 1, Math.round(ratio * Math.max(0, nextCount - 1))));
      }
      return nextCount;
    });
  }, [chapterContent, pageWidth, preferences.fontSize, preferences.lineHeight, preferences.readingMode, safePageIndex]);

  useLayoutEffect(() => {
    if (preferences.readingMode !== "page") return;
    const viewport = pageViewportRef.current;
    if (viewport) viewport.scrollLeft = safePageIndex * (pageWidth + PAGE_GAP);
  }, [pageWidth, preferences.readingMode, safePageIndex, turn.token]);

  useEffect(() => {
    if (preferences.readingMode !== "page" || preferences.animation !== "slide" || !turn.token || reducedMotion) return;
    const page = pageRef.current;
    if (!page) return;
    const isForward = turn.direction === "forward";
    page.animate([
      { opacity: .3, transform: `translateX(${isForward ? 38 : -38}px)` },
      { opacity: 1, transform: "none" },
    ], {
      duration: 270,
      easing: "ease",
    });
  }, [preferences.animation, preferences.readingMode, reducedMotion, turn]);

  useEffect(() => {
    if (!activeBook || !chapter) return;
    const semantic = preferences.readingMode === "page"
      ? locationForOffset(paragraphs, Math.floor((safePageIndex / pageCount) * chapter.characterCount))
      : semanticLocationRef.current;
    const location: ReaderLocation = {
      version: READER_DATA_VERSION,
      chapterId: chapter.id,
      chapterIndex,
      paragraphIndex: semantic.paragraphIndex,
      characterOffset: semantic.characterOffset,
      pageIndex: safePageIndex,
      scrollProgress,
      updatedAt: timestamp(),
    };
    progressSnapshotRef.current = { bookId: activeBook.id, location };
    if (progressTimerRef.current) window.clearTimeout(progressTimerRef.current);
    progressTimerRef.current = window.setTimeout(() => {
      saveReaderLocation(activeBook.id, location);
      saveReaderActivity({
        bookId: activeBook.id,
        title: activeBook.title,
        author: activeBook.author,
        progress,
        lastReadAt: timestamp(),
      });
      progressTimerRef.current = null;
    }, 700);
    return () => {
      if (progressTimerRef.current) window.clearTimeout(progressTimerRef.current);
    };
  }, [activeBook, chapter, chapterIndex, pageCount, paragraphs, preferences.readingMode, progress, safePageIndex, scrollProgress]);

  useEffect(() => {
    const flushProgress = () => {
      const snapshot = progressSnapshotRef.current;
      if (snapshot) saveReaderLocation(snapshot.bookId, snapshot.location);
    };
    window.addEventListener("pagehide", flushProgress);
    return () => {
      flushProgress();
      window.removeEventListener("pagehide", flushProgress);
    };
  }, []);

  useLayoutEffect(() => {
    if (!activeBook || !chapter || preferences.readingMode !== "scroll") return;
    const stage = stageRef.current;
    if (!stage) return;
    const location = pendingLocationRef.current;
    if (!location) return;
    const available = Math.max(0, stage.scrollHeight - stage.clientHeight);
    const target = location?.chapterId === chapter.id
      ? stage.querySelector<HTMLElement>(`[data-reader-paragraph="${location.paragraphIndex}"]`)
      : null;
    if (target && location) {
      const stageTop = stage.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      const characterRatio = target.textContent?.length ? location.characterOffset / target.textContent.length : 0;
      stage.scrollTop += targetTop - stageTop + target.offsetHeight * characterRatio - READING_ANCHOR_OFFSET;
    } else {
      stage.scrollTop = (location?.scrollProgress ?? 0) * available;
    }
    pendingLocationRef.current = null;
  }, [activeBook, chapter, chapterIndex, locationJumpToken, preferences.fontSize, preferences.lineHeight, preferences.readingMode]);

  const activateBook = (book: StoredBook, parsed: ReaderChapter[]) => {
    const position = readReaderLocation(book.id, parsed);
    const compact = hasCompactReaderViewport();
    semanticLocationRef.current = {
      paragraphIndex: position.paragraphIndex,
      characterOffset: position.characterOffset,
    };
    pendingLocationRef.current = position;
    setActiveBook(book);
    setChapters(parsed);
    setChapterIndex(Math.min(position.chapterIndex, Math.max(0, parsed.length - 1)));
    setPageIndex(position.pageIndex);
    setScrollProgress(position.scrollProgress);
    setBookmarks(readReaderBookmarks(book.id));
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setMessage("");
    setSidebarOpen(!compact);
    setImmersive(compact);
    setChromeHidden(false);
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    if (compact) chromeTimerRef.current = window.setTimeout(() => setChromeHidden(true), 2200);
  };

  const openBook = async (book: StoredBook | StoredBookSummary) => {
    requestedBookRef.current = book.id;
    setOpeningBookId(book.id);
    setMessage("");
    try {
      const stored = "content" in book ? book : await getStoredBook(book.id);
      if (!stored) throw new Error("书籍不存在");
      let prepared = stored;
      let parsed = stored.chapterIndex;
      if (stored.readerVersion !== READER_DATA_VERSION || !parsed?.length) {
        const result = await processBookText({ content: stored.content });
        prepared = {
          ...stored,
          content: result.content,
          readerVersion: READER_DATA_VERSION,
          chapterIndex: result.chapters,
        };
        parsed = result.chapters;
        await storeBook(prepared);
        if (prepared.source === "local") {
          const summary = summarizeStoredBook(prepared);
          setLocalBooks((current) => current.map((item) => item.id === prepared.id ? summary : item));
        }
      }
      if (requestedBookRef.current === book.id) activateBook(prepared, parsed);
    } catch {
      setMessage(`“${book.title}”解析失败`);
    } finally {
      setOpeningBookId((current) => current === book.id ? null : current);
    }
  };

  useEffect(() => {
    if (!launchIntent || lastLaunchRequestRef.current === launchIntent.requestId) return;
    lastLaunchRequestRef.current = launchIntent.requestId;
    let cancelled = false;
    void (async () => {
      try {
        const book = await getStoredBook(launchIntent.bookId);
        if (cancelled) return;
        if (book) await openBook(book);
        else setMessage("这本书已不在本地书库中");
      } catch {
        if (!cancelled) setMessage("本地书库读取失败");
      }
      if (!cancelled) onLaunchHandled(launchIntent.requestId);
    })();
    return () => {
      cancelled = true;
    };
  }, [launchIntent, onLaunchHandled]);

  const readDownload = async (response: Response, book: CatalogBook) => {
    if (!response.body) return response.arrayBuffer();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    const total = Number(response.headers.get("content-length")) || book.size;
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      setDownloadProgress((current) => ({ ...current, [book.id]: Math.min(99, Math.round(received / total * 100)) }));
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged.buffer;
  };

  const downloadOrOpen = async (book: CatalogBook) => {
    if (downloading.has(book.id)) return;
    requestedBookRef.current = book.id;
    setDownloading((current) => new Set(current).add(book.id));
    setMessage("");
    try {
      let stored = await getStoredBook(book.id);
      if (stored && stored.version === book.version) {
        const currentBook = stored;
        setDownloads((current) => ({ ...current, [book.id]: { version: currentBook.version, downloadedAt: currentBook.downloadedAt } }));
        if (requestedBookRef.current === book.id) await openBook(currentBook);
        return;
      }
      if (!stored || stored.version !== book.version) {
        const controller = new AbortController();
        downloadControllersRef.current.set(book.id, controller);
        setDownloadProgress((current) => ({ ...current, [book.id]: 0 }));
        const response = await fetch(book.url, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const result = await processBookText({ buffer: await readDownload(response, book) });
        stored = {
          ...book,
          content: result.content,
          downloadedAt: timestamp(),
          source: "cloud",
          readerVersion: READER_DATA_VERSION,
          chapterIndex: result.chapters,
        };
        await storeBook(stored);
      }
      setDownloads((current) => ({ ...current, [book.id]: { version: stored.version, downloadedAt: stored.downloadedAt } }));
      if (requestedBookRef.current === book.id) activateBook(stored, stored.chapterIndex!);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(`“${book.title}”下载失败，请稍后重试`);
    } finally {
      downloadControllersRef.current.delete(book.id);
      setDownloadProgress((current) => { const next = { ...current }; delete next[book.id]; return next; });
      setDownloading((current) => { const next = new Set(current); next.delete(book.id); return next; });
    }
  };

  const cancelDownload = (id: string) => downloadControllersRef.current.get(id)?.abort();

  const clearShelfPress = () => {
    if (shelfPressRef.current) window.clearTimeout(shelfPressRef.current.timer);
    shelfPressRef.current = null;
  };
  const beginShelfPress = (event: React.PointerEvent<HTMLElement>, id: string, manageable: boolean) => {
    if (!manageable || event.button !== 0 || !isCompactDesktopViewport()) return;
    clearShelfPress();
    const x = event.clientX;
    const y = event.clientY;
    shelfPressRef.current = {
      id,
      x,
      y,
      timer: window.setTimeout(() => {
        suppressShelfOpenRef.current = id;
        setShelfEditing(true);
        setDeleteCandidate(null);
        shelfPressRef.current = null;
      }, DESKTOP_ICON_LONG_PRESS_MS),
    };
  };
  const updateShelfPress = (event: React.PointerEvent<HTMLElement>) => {
    const press = shelfPressRef.current;
    if (press && movedBeyondLongPressTolerance(press, { x: event.clientX, y: event.clientY })) clearShelfPress();
  };
  const finishShelfPress = () => clearShelfPress();
  const handleShelfOpen = (id: string, open: () => void) => {
    if (suppressShelfOpenRef.current === id) {
      suppressShelfOpenRef.current = null;
      return;
    }
    if (shelfEditing && isCompactDesktopViewport()) {
      setShelfEditing(false);
      return;
    }
    open();
  };

  const importBook = async (file?: File) => {
    if (!file) return;
    if (file.type !== "text/plain" && !file.name.toLowerCase().endsWith(".txt")) {
      setMessage("目前仅支持导入 TXT 书籍");
      return;
    }
    setMessage("");
    try {
      const result = await processBookText({ buffer: await file.arrayBuffer() });
      const title = file.name.replace(/\.txt$/i, "") || "未命名书籍";
      const book: StoredBook = { id: `local:${crypto.randomUUID()}`, title, author: "本地导入", description: `来自 ${file.name}`, cover: "slate", file: file.name, url: "", size: file.size, version: "local", content: result.content, downloadedAt: timestamp(), source: "local", readerVersion: READER_DATA_VERSION, chapterIndex: result.chapters };
      await storeBook(book);
      setLocalBooks((current) => [summarizeStoredBook(book), ...current]);
      requestedBookRef.current = book.id;
      activateBook(book, result.chapters);
    } catch {
      setMessage(`“${file.name}”导入失败`);
    }
  };

  const removeLocalBook = async (book: StoredBookSummary) => {
    try {
      await deleteStoredBook(book.id);
      removeReaderBookData(book.id);
      if (progressSnapshotRef.current?.bookId === book.id) progressSnapshotRef.current = null;
      setLocalBooks((current) => current.filter((item) => item.id !== book.id));
      setActivity(readReaderActivity());
      setDeleteCandidate(null);
    } catch {
      setMessage(`“${book.title}”删除失败`);
    }
  };

  const removeCloudDownload = async (book: CatalogBook) => {
    try {
      await deleteStoredBook(book.id);
      removeReaderBookData(book.id);
      if (progressSnapshotRef.current?.bookId === book.id) progressSnapshotRef.current = null;
      setDownloads((current) => { const next = { ...current }; delete next[book.id]; return next; });
      setActivity(readReaderActivity());
      setDeleteCandidate(null);
    } catch {
      setMessage(`“${book.title}”删除失败`);
    }
  };

  const animate = useCallback((direction: "forward" | "back") => {
    if (preferences.animation === "slide") setTurn((current) => ({ direction, token: current.token + 1 }));
  }, [preferences.animation]);
  const resetScroll = useCallback(() => {
    pendingLocationRef.current = null;
    semanticLocationRef.current = { paragraphIndex: 0, characterOffset: 0 };
    setScrollProgress(0);
    if (stageRef.current) stageRef.current.scrollTop = 0;
  }, []);
  const nextPage = useCallback(() => {
    if (safePageIndex < pageCount - 1) setPageIndex(safePageIndex + 1);
    else if (chapterIndex < chapters.length - 1) { setChapterIndex(chapterIndex + 1); setPageIndex(0); resetScroll(); }
    else return;
    animate("forward");
  }, [animate, chapterIndex, chapters.length, pageCount, resetScroll, safePageIndex]);
  const previousPage = useCallback(() => {
    if (safePageIndex > 0) setPageIndex(safePageIndex - 1);
    else if (chapterIndex > 0) { pendingLastPageRef.current = true; setChapterIndex(chapterIndex - 1); setPageIndex(0); resetScroll(); }
    else return;
    animate("back");
  }, [animate, chapterIndex, resetScroll, safePageIndex]);
  const nextChapter = useCallback(() => {
    if (chapterIndex >= chapters.length - 1) return;
    setChapterIndex(chapterIndex + 1);
    setPageIndex(0);
    resetScroll();
  }, [chapterIndex, chapters.length, resetScroll]);
  const previousChapter = useCallback(() => {
    if (chapterIndex <= 0) return;
    setChapterIndex(chapterIndex - 1);
    setPageIndex(0);
    resetScroll();
  }, [chapterIndex, resetScroll]);

  useEffect(() => {
    if (!active || !activeBook) return;
    const keyboard = (event: KeyboardEvent) => {
      if (settingsOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable='true']")) return;
      if (preferences.readingMode === "scroll") {
        if (event.key === "ArrowRight") { event.preventDefault(); nextChapter(); }
        if (event.key === "ArrowLeft") { event.preventDefault(); previousChapter(); }
        if (event.key === "PageDown" || event.key === " ") { event.preventDefault(); stageRef.current?.scrollBy({ top: stageRef.current.clientHeight * .82, behavior: "smooth" }); }
        if (event.key === "PageUp") { event.preventDefault(); stageRef.current?.scrollBy({ top: -stageRef.current.clientHeight * .82, behavior: "smooth" }); }
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") { event.preventDefault(); nextPage(); }
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); previousPage(); }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [active, activeBook, nextChapter, nextPage, preferences.readingMode, previousChapter, previousPage, settingsOpen]);

  const selectChapter = (index: number) => {
    setChapterIndex(index);
    setPageIndex(0);
    resetScroll();
    animate(index >= chapterIndex ? "forward" : "back");
    if (hasCompactReaderViewport()) setSidebarOpen(false);
  };
  const setReadingMode = (readingMode: ReadingMode) => {
    if (readingMode === preferences.readingMode) return;
    if (readingMode === "scroll") {
      const nextProgress = safePageIndex / pageCount;
      const semantic = locationForOffset(paragraphs, Math.floor(nextProgress * (chapter?.characterCount ?? 0)));
      semanticLocationRef.current = semantic;
      pendingLocationRef.current = chapter ? {
        version: READER_DATA_VERSION,
        chapterId: chapter.id,
        chapterIndex,
        paragraphIndex: semantic.paragraphIndex,
        characterOffset: semantic.characterOffset,
        pageIndex: safePageIndex,
        scrollProgress: nextProgress,
        updatedAt: timestamp(),
      } : null;
      setScrollProgress(nextProgress);
    } else {
      setPageIndex(Math.min(pageCount - 1, Math.floor(scrollProgress * pageCount)));
    }
    setPreferences({ ...preferences, readingMode });
  };
  const updateTypography = (patch: Pick<ReaderPreferences, "fontSize"> | Pick<ReaderPreferences, "lineHeight">) => {
    if (preferences.readingMode === "scroll" && chapter) {
      pendingLocationRef.current = {
        version: READER_DATA_VERSION,
        chapterId: chapter.id,
        chapterIndex,
        paragraphIndex: semanticLocationRef.current.paragraphIndex,
        characterOffset: semanticLocationRef.current.characterOffset,
        pageIndex: safePageIndex,
        scrollProgress,
        updatedAt: timestamp(),
      };
    }
    setPreferences({ ...preferences, ...patch });
  };
  const updateScrollProgress = () => {
    if (preferences.readingMode !== "scroll") return;
    if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const stage = stageRef.current;
      if (!stage) return;
      const available = stage.scrollHeight - stage.clientHeight;
      const nextProgress = available > 0 ? stage.scrollTop / available : 1;
      const targetTop = stage.getBoundingClientRect().top + READING_ANCHOR_OFFSET;
      const segmentElements = stage.querySelectorAll<HTMLElement>("[data-reader-segment]");
      let visibleSegment = segmentElements[0];
      for (const segment of segmentElements) {
        visibleSegment = segment;
        if (segment.getBoundingClientRect().bottom >= targetTop) break;
      }
      const paragraphElements = visibleSegment?.querySelectorAll<HTMLElement>("[data-reader-paragraph]") ?? [];
      let visible = paragraphElements[0];
      for (const element of paragraphElements) {
        visible = element;
        if (element.getBoundingClientRect().bottom >= targetTop) break;
      }
      if (visible) {
        const index = Number(visible.dataset.readerParagraph ?? 0);
        const textLength = visible.textContent?.length ?? 0;
        const rect = visible.getBoundingClientRect();
        const ratio = rect.height ? Math.min(1, Math.max(0, (targetTop - rect.top) / rect.height)) : 0;
        semanticLocationRef.current = { paragraphIndex: index, characterOffset: Math.round(textLength * ratio) };
      }
      setScrollProgress((current) => Math.abs(current - nextProgress) >= .001 ? nextProgress : current);
    });
  };
  const goLibrary = () => {
    const snapshot = progressSnapshotRef.current;
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (snapshot) saveReaderLocation(snapshot.bookId, snapshot.location);
    setActivity(readReaderActivity());
    progressSnapshotRef.current = null;
    setActiveBook(null);
    setChapters([]);
    setSettingsOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearching(false);
    setImmersive(false);
    setChromeHidden(false);
    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }
  };
  const toggleMobileChrome = () => {
    if (!immersive || !hasCompactReaderViewport()) return;
    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }
    setChromeHidden((current) => !current);
  };
  const beginPageGesture = (event: React.PointerEvent<HTMLElement>) => {
    if (preferences.readingMode === "page" || immersive && hasCompactReaderViewport()) {
      pagePointerRef.current = { x: event.clientX, y: event.clientY };
    }
  };
  const finishPageGesture = (event: React.PointerEvent<HTMLElement>) => {
    const start = pagePointerRef.current;
    pagePointerRef.current = null;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && pageRef.current?.contains(selection.anchorNode)) {
      setSelectedExcerpt(selection.toString().trim());
      return;
    }
    setSelectedExcerpt("");
    if (!start) return;
    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;
    const interactiveTarget = (event.target as HTMLElement).closest("button,input,textarea,select,label");
    if (!interactiveTarget && immersive && hasCompactReaderViewport() && Math.abs(horizontal) < 12 && Math.abs(vertical) < 12) {
      toggleMobileChrome();
      return;
    }
    if (preferences.readingMode !== "page") return;
    if (Math.abs(horizontal) < 44 || Math.abs(horizontal) <= Math.abs(vertical)) return;
    if (pageFlipEnabled) {
      if (horizontal < 0 && safePageIndex === pageCount - 1) nextPage();
      if (horizontal > 0 && safePageIndex === 0) previousPage();
      return;
    }
    if (horizontal < 0) nextPage();
    else previousPage();
  };
  const createExcerpt = () => {
    if (!activeBook || !chapter || !selectedExcerpt) return;
    onCreateExcerpt(readerExcerpt(activeBook.title, chapter.title, selectedExcerpt));
    window.getSelection()?.removeAllRanges();
    setSelectedExcerpt("");
  };
  const jumpToLocation = (target: Pick<ReaderLocation, "chapterId" | "paragraphIndex" | "characterOffset">) => {
    const index = chapters.findIndex((item) => item.id === target.chapterId);
    if (index < 0) return;
    const location: ReaderLocation = {
      version: READER_DATA_VERSION,
      chapterId: target.chapterId,
      chapterIndex: index,
      paragraphIndex: target.paragraphIndex,
      characterOffset: target.characterOffset,
      pageIndex: 0,
      scrollProgress: 0,
      updatedAt: timestamp(),
    };
    semanticLocationRef.current = { paragraphIndex: target.paragraphIndex, characterOffset: target.characterOffset };
    pendingLocationRef.current = location;
    setChapterIndex(index);
    setPageIndex(0);
    setPreferences((current) => ({ ...current, readingMode: "scroll" }));
    setLocationJumpToken((current) => current + 1);
    setSearchOpen(false);
    if (hasCompactReaderViewport()) setSidebarOpen(false);
  };
  const addBookmark = () => {
    if (!activeBook || !chapter) return;
    const semantic = preferences.readingMode === "page"
      ? locationForOffset(paragraphs, Math.floor((safePageIndex / pageCount) * chapter.characterCount))
      : semanticLocationRef.current;
    if (bookmarks.some((item) => item.chapterId === chapter.id && item.paragraphIndex === semantic.paragraphIndex)) return;
    const bookmark: ReaderBookmark = {
      id: crypto.randomUUID(),
      bookId: activeBook.id,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      paragraphIndex: semantic.paragraphIndex,
      characterOffset: semantic.characterOffset,
      excerpt: paragraphs[semantic.paragraphIndex]?.text.slice(0, 72) || chapter.title,
      createdAt: timestamp(),
    };
    const next = [bookmark, ...bookmarks];
    setBookmarks(next);
    saveReaderBookmarks(activeBook.id, next);
    setSidebarTab("bookmarks");
    if (!hasCompactReaderViewport()) setSidebarOpen(true);
  };
  const removeBookmark = (id: string) => {
    if (!activeBook) return;
    const next = bookmarks.filter((item) => item.id !== id);
    setBookmarks(next);
    saveReaderBookmarks(activeBook.id, next);
  };
  const revealChrome = () => {
    if (!immersive || hasCompactReaderViewport()) return;
    setChromeHidden(false);
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = window.setTimeout(() => setChromeHidden(true), 2200);
  };
  const toggleImmersive = () => {
    const next = !immersive;
    setImmersive(next);
    setChromeHidden(false);
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    if (next) chromeTimerRef.current = window.setTimeout(() => setChromeHidden(true), 2200);
  };
  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    if (next) {
      setSearchOpen(false);
      setSettingsOpen(false);
    }
  };
  const toggleSearch = () => {
    const next = !searchOpen;
    setSearchOpen(next);
    if (next) {
      setSidebarOpen(false);
      setSettingsOpen(false);
    }
  };
  const toggleSettings = () => {
    const next = !settingsOpen;
    setSettingsOpen(next);
    if (next) {
      setSidebarOpen(false);
      setSearchOpen(false);
    }
  };
  useEffect(() => {
    if (!searchOpen || !activeBook) return;
    if (!searchQuery.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      const worker = getReaderWorker();
      const requestId = ++workerRequestRef.current;
      const search = new Promise<ReaderSearchResult[]>((resolve, reject) => {
        workerPendingRef.current.set(requestId, {
          resolve: (result) => resolve(result.results ?? []),
          reject,
        });
        worker.postMessage({ requestId, type: "search", content: activeBook.content, chapters, query: searchQuery });
      });
      void search.then((results) => {
        if (!cancelled) setSearchResults(results);
      }).catch(() => {
        if (!cancelled) setSearchResults([]);
      }).finally(() => {
        if (!cancelled) setSearching(false);
      });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeBook, chapters, getReaderWorker, searchOpen, searchQuery]);
  useEffect(() => () => {
    for (const controller of downloadControllersRef.current.values()) controller.abort();
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void navigator.storage?.estimate().then((estimate) => {
      if (!cancelled) setStorageUsage(estimate.usage ?? null);
    });
    return () => { cancelled = true; };
  }, [downloads, localBooks.length]);
  const allSummaries = [...localBooks, ...catalog.filter((book) => downloads[book.id]).map((book) => ({ ...book, downloadedAt: downloads[book.id].downloadedAt, source: "cloud" as const }))];
  const recentActivity = Object.values(activity).filter((item) => allSummaries.some((book) => book.id === item.bookId)).sort((a, b) => b.lastReadAt - a.lastReadAt)[0];
  const recentBook = recentActivity ? allSummaries.find((book) => book.id === recentActivity.bookId) : null;
  const query = shelfQuery.trim().toLocaleLowerCase();
  const matchesShelf = (book: CatalogBook | StoredBookSummary) => !query || `${book.title} ${book.author} ${book.description}`.toLocaleLowerCase().includes(query);
  const visibleLocalBooks = localBooks.filter((book) => matchesShelf(book) && (shelfFilter === "all" || shelfFilter === "local" || shelfFilter === "downloaded"));
  const visibleCatalog = catalog.filter((book) => matchesShelf(book) && (
    shelfFilter === "all"
    || shelfFilter === "downloaded" && !!downloads[book.id]
    || shelfFilter === "cloud" && !downloads[book.id]
  ));

  if (!activeBook) return <div className={`reader-library ${shelfEditing ? "editing" : ""}`}>
    <header className="reader-library-header"><div><span className="reader-brand">阅</span><div><strong>NOVA 阅读</strong><small>{shelfEditing ? "管理书架" : `${localBooks.length + Object.keys(downloads).length} 本已存储`}</small></div></div><div className="reader-library-actions">{shelfEditing ? <button className="reader-library-done" aria-label="完成管理书架" title="完成" onClick={() => { setShelfEditing(false); setDeleteCandidate(null); }}><span aria-hidden="true">✓</span></button> : <><label className="reader-import-button">＋ 导入 TXT<input ref={importRef} aria-label="选择要导入的TXT书籍" type="file" accept=".txt,text/plain" onChange={(event) => { void importBook(event.target.files?.[0]); event.target.value = ""; }}/></label><button className="reader-refresh-button" aria-label="检查云端书库" title="检查云端书库" onClick={loadCatalog}>↻</button></>}</div></header>
    <section className="reader-library-tools">
      <label className="reader-library-search"><span aria-hidden="true">⌕</span><input value={shelfQuery} onChange={(event) => setShelfQuery(event.target.value)} aria-label="搜索书架" placeholder="搜索书名、作者"/></label>
      <div className="reader-library-filters">{(["all", "downloaded", "local", "cloud"] as ShelfFilter[]).map((filter) => <button key={filter} className={shelfFilter === filter ? "active" : ""} onClick={() => setShelfFilter(filter)}>{filter === "all" ? "全部" : filter === "downloaded" ? "已下载" : filter === "local" ? "本地" : "云端"}</button>)}</div>
      <span>{storageUsage === null ? "本地存储" : `已使用 ${formatSize(storageUsage)}`}</span>
    </section>
    {recentBook && recentActivity && <section className="reader-continue"><span className={`reader-cover cover-${recentBook.cover}`}><i>RECENT</i><strong>{recentBook.title}</strong><small>{recentBook.author}</small></span><div><small>最近阅读</small><strong>{recentBook.title}</strong><p>{recentActivity.progress}% · {new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(recentActivity.lastReadAt)}</p><i><span style={{ width: `${recentActivity.progress}%` }}/></i></div><button onClick={() => void openBook(recentBook)}>继续阅读</button></section>}
    {!!visibleLocalBooks.length && <><header className="reader-shelf-title"><strong>本地书籍</strong><span>{visibleLocalBooks.length} 本</span></header><section className="reader-shelf reader-local-shelf">{visibleLocalBooks.map((book) => <article className="reader-book-card manageable" key={book.id} onPointerDown={(event) => beginShelfPress(event, book.id, true)} onPointerMove={updateShelfPress} onPointerUp={finishShelfPress} onPointerCancel={finishShelfPress}><button className="reader-book-open" disabled={openingBookId === book.id} onClick={() => handleShelfOpen(book.id, () => void openBook(book))}><span className={`reader-cover cover-${book.cover}`}><i>LOCAL</i><strong>{book.title}</strong><small>{book.author}</small></span><span className="reader-book-info"><strong>{book.title}</strong><small>{book.author}</small><p>{book.description}</p><em className="downloaded">{openingBookId === book.id ? "正在整理章节…" : `继续阅读 · ${formatSize(book.size)}`}</em></span></button><button className="reader-book-delete" disabled={openingBookId === book.id} aria-label={`删除${book.title}`} title="删除本地书籍" onClick={() => setDeleteCandidate({ id: book.id, type: "local" })}>×</button>{deleteCandidate?.id === book.id && <aside className="reader-delete-confirm"><strong>移除这本书？</strong><button onClick={() => setDeleteCandidate(null)}>取消</button><button onClick={() => void removeLocalBook(book)}>删除</button></aside>}</article>)}</section></>}
    {(shelfFilter === "all" || shelfFilter === "cloud" || shelfFilter === "downloaded") && <><header className="reader-shelf-title"><strong>{shelfFilter === "downloaded" ? "已下载书籍" : "云端书库"}</strong><span>{visibleCatalog.length} 本</span></header>
    {catalogState === "loading" ? <div className="reader-state"><i/><strong>正在查看云端书库</strong></div> : catalogState === "error" ? <div className="reader-state"><strong>云端书库暂时不可用</strong><button onClick={loadCatalog}>重新检查</button></div> : <section className="reader-shelf">{visibleCatalog.map((book) => {
      const downloaded = downloads[book.id];
      const current = downloaded?.version === book.version;
      const percent = downloadProgress[book.id];
      return <article className={`reader-book-card ${downloaded ? "manageable" : ""}`} key={book.id} onPointerDown={(event) => beginShelfPress(event, book.id, !!downloaded)} onPointerMove={updateShelfPress} onPointerUp={finishShelfPress} onPointerCancel={finishShelfPress}><button className="reader-book-open" onClick={() => handleShelfOpen(book.id, () => void downloadOrOpen(book))} disabled={downloading.has(book.id) || openingBookId === book.id}>
          <span className={`reader-cover cover-${book.cover}`}><i>NOVA</i><strong>{book.title}</strong><small>{book.author}</small></span>
          <span className="reader-book-info"><strong>{book.title}</strong><small>{book.author}</small><p>{book.description}</p><em className={current ? "downloaded" : "cloud"}>{downloading.has(book.id) ? `正在下载 ${percent ?? 0}%` : openingBookId === book.id ? "正在整理章节…" : current ? `继续阅读 · ${formatSize(book.size)}` : downloaded ? "发现云端更新" : `云端 · ${formatSize(book.size)}`}</em></span>
        </button>{downloading.has(book.id) ? <button className="reader-book-delete cancel-download" aria-label={`取消下载${book.title}`} title="取消下载" onClick={() => cancelDownload(book.id)}>×</button> : downloaded && <button className="reader-book-delete" disabled={openingBookId === book.id} aria-label={`删除${book.title}下载`} title="删除下载" onClick={() => setDeleteCandidate({ id: book.id, type: "cloud" })}>×</button>}{deleteCandidate?.id === book.id && <aside className="reader-delete-confirm"><strong>删除本地下载？</strong><button onClick={() => setDeleteCandidate(null)}>取消</button><button onClick={() => void removeCloudDownload(book)}>删除</button></aside>}</article>;
    })}</section>}</>}
    {!visibleLocalBooks.length && !visibleCatalog.length && catalogState === "ready" && <div className="reader-state"><strong>没有匹配的书籍</strong><button onClick={() => { setShelfQuery(""); setShelfFilter("all"); }}>清除筛选</button></div>}
    {message && <div className="reader-message">{message}</div>}
  </div>;

  return <div className={`reader-reading theme-${preferences.theme} mode-${preferences.readingMode} ${immersive ? "immersive" : ""} ${chromeHidden ? "chrome-hidden" : ""}`} onPointerDown={revealChrome} onPointerMove={revealChrome}>
    <div className="reader-device-status" aria-label={`当前时间 ${clock.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}${battery ? `，电量 ${Math.round(battery.level * 100)}%` : ""}`}>
      <time>{clock.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
      {battery && <span className="reader-battery"><i style={{ "--battery-level": `${Math.round(battery.level * 100)}%` } as CSSProperties}/><b>{Math.round(battery.level * 100)}</b>{battery.charging && <em aria-label="正在充电">⚡</em>}</span>}
    </div>
    <header className="reader-toolbar"><div className="reader-toolbar-navigation"><button aria-label="返回书架" title="返回书架" onClick={goLibrary}><span aria-hidden="true">←</span><span className="reader-toolbar-label">书架</span></button><button aria-label={sidebarOpen ? "关闭目录" : "打开目录"} aria-expanded={sidebarOpen} title="目录与书签" onClick={toggleSidebar}><span aria-hidden="true">☰</span><span className="reader-toolbar-label">目录</span></button></div><div className="reader-book-heading"><strong>{activeBook.title}</strong><small>{chapter?.title}</small></div><div className="reader-toolbar-actions"><button aria-label="摘录到记事本" title="摘录到记事本" disabled={!selectedExcerpt} onClick={createExcerpt}>✎</button><button aria-label="搜索书内内容" aria-expanded={searchOpen} title="搜索" onClick={toggleSearch}>⌕</button><button aria-label="添加书签" title="添加书签" onClick={addBookmark}>☆</button><button aria-label={immersive ? "退出沉浸阅读" : "进入沉浸阅读"} title={immersive ? "退出沉浸阅读" : "沉浸阅读"} onClick={toggleImmersive}>⛶</button><span className="reader-toolbar-progress">{progress}%</span><button aria-label="阅读设置" aria-expanded={settingsOpen} title="阅读设置" onClick={toggleSettings}>Aa</button></div></header>
    <div className="reader-body">
      {sidebarOpen && <button className="reader-sidebar-scrim" aria-label="关闭目录" onClick={() => setSidebarOpen(false)}/>}
      {sidebarOpen && <aside className="reader-chapters"><header><div><button className={sidebarTab === "chapters" ? "active" : ""} onClick={() => setSidebarTab("chapters")}>目录</button><button className={sidebarTab === "bookmarks" ? "active" : ""} onClick={() => setSidebarTab("bookmarks")}>书签</button></div><span>{sidebarTab === "chapters" ? `${chapters.length} 章` : `${bookmarks.length} 个`}</span></header>{sidebarTab === "chapters" ? <div>{chapters.map((item, index) => <button key={`${item.title}-${index}`} className={index === chapterIndex ? "active" : ""} onClick={() => selectChapter(index)}><span>{item.title}</span>{index === chapterIndex && <small>{preferences.readingMode === "scroll" ? `${Math.round(scrollProgress * 100)}%` : `${safePageIndex + 1}/${pageCount}`}</small>}</button>)}</div> : <div className="reader-bookmarks">{bookmarks.map((bookmark) => <article key={bookmark.id}><button onClick={() => jumpToLocation(bookmark)}><strong>{bookmark.chapterTitle}</strong><span>{bookmark.excerpt}</span></button><button aria-label="删除书签" title="删除书签" onClick={() => removeBookmark(bookmark.id)}>×</button></article>)}{!bookmarks.length && <p>还没有书签</p>}</div>}</aside>}
      <main key={`${activeBook.id}-${preferences.readingMode}`} ref={stageRef} className={`reader-stage reader-stage-${preferences.readingMode} ${pageFlipEnabled ? "reader-stage-flip" : ""}`} onScroll={updateScrollProgress} onPointerDown={beginPageGesture} onPointerUp={finishPageGesture} onPointerCancel={() => { pagePointerRef.current = null; }}>
        <article
          ref={pageRef}
          className={`reader-page ${pageFlipEnabled ? "reader-page-measure" : ""}`}
          style={{
            "--reader-font-size": `${preferences.fontSize}px`,
            lineHeight: preferences.lineHeight,
          } as CSSProperties}
        >
          <header><span>{activeBook.title}</span><span>{chapter?.title}</span></header>
          {preferences.readingMode === "scroll" && <h1>{chapter?.title}</h1>}
          {preferences.readingMode === "scroll" ? <div className="reader-content">{paragraphSegments.map((segment, segmentIndex) => <section className="reader-paragraph-segment" data-reader-segment={segmentIndex} key={segmentIndex}>{segment.map((paragraph) => <p key={paragraph.index} data-reader-paragraph={paragraph.index}>{paragraph.text}</p>)}</section>)}</div> : <div className="reader-page-viewport" ref={pageViewportRef}><div className="reader-page-flow" ref={pageFlowRef} style={{ columnWidth: pageWidth || undefined, columnGap: PAGE_GAP }}><h1>{chapter?.title}</h1>{paragraphs.map((paragraph) => <p key={paragraph.index}>{paragraph.text}</p>)}</div></div>}
          {preferences.readingMode === "scroll" && <nav className="reader-chapter-navigation" aria-label="章节切换"><button disabled={chapterIndex === 0} onClick={previousChapter}>← 上一章</button><span>第 {chapterIndex + 1} / {chapters.length} 章</span><button disabled={chapterIndex === chapters.length - 1} onClick={nextChapter}>下一章 →</button></nav>}
          <footer><span>{activeBook.author}</span><span>{preferences.readingMode === "scroll" ? `${Math.round(scrollProgress * 100)}%` : `${safePageIndex + 1} / ${pageCount}`}</span></footer>
        </article>
        {pageFlipEnabled && <ReaderFlipBook
          key={`${chapter?.id ?? "chapter"}:${pageCount}`}
          title={activeBook.title}
          author={activeBook.author}
          chapterTitle={chapter?.title ?? ""}
          paragraphs={paragraphs}
          pageIndex={safePageIndex}
          pageCount={pageCount}
          pageWidth={pageSize.width}
          pageHeight={pageSize.height}
          flowPageWidth={pageWidth}
          pageGap={PAGE_GAP}
          fontSize={preferences.fontSize}
          lineHeight={preferences.lineHeight}
          nextChapter={nextFlipChapter}
          onPageChange={setPageIndex}
          onBoundaryPrevious={previousPage}
          onBoundaryNext={nextPage}
        />}
        {preferences.readingMode === "page" && !pageFlipEnabled && <><button className="reader-turn-zone previous" aria-label="上一页" onClick={previousPage}>‹</button><button className="reader-turn-zone next" aria-label="下一页" onClick={nextPage}>›</button></>}
      </main>
      {(searchOpen || settingsOpen) && <button className="reader-panel-scrim" aria-label="关闭阅读面板" onClick={() => { setSearchOpen(false); setSettingsOpen(false); }}/>}
      {searchOpen && <aside className="reader-search-panel"><header><label><span aria-hidden="true">⌕</span><input value={searchQuery} onChange={(event) => { const value = event.target.value; setSearchQuery(value); if (!value.trim()) { setSearchResults([]); setSearching(false); } }} aria-label="搜索书内内容" placeholder="搜索当前书籍"/></label><button aria-label="关闭搜索" onClick={() => setSearchOpen(false)}>×</button></header><div>{searching ? <p>正在搜索…</p> : searchResults.map((result) => <button key={result.id} onClick={() => jumpToLocation(result)}><strong>{result.chapterTitle}</strong><span>{result.excerpt}</span></button>)}{!searching && searchQuery && !searchResults.length && <p>没有找到相关内容</p>}</div></aside>}
      {settingsOpen && <aside className="reader-settings"><header><strong>阅读设置</strong><button aria-label="关闭阅读设置" onClick={() => setSettingsOpen(false)}>×</button></header><span className="reader-setting-label">阅读方式</span><div className="reading-mode-options"><button className={preferences.readingMode === "scroll" ? "active" : ""} onClick={() => setReadingMode("scroll")}>上下滚动</button><button className={preferences.readingMode === "page" ? "active" : ""} onClick={() => setReadingMode("page")}>左右翻页</button></div><span className="reader-setting-label">阅读背景</span><div className="theme-options">{(["paper", "green", "night"] as ReaderTheme[]).map((theme) => <button key={theme} className={`${theme} ${preferences.theme === theme ? "active" : ""}`} onClick={() => setPreferences({ ...preferences, theme })}>{theme === "paper" ? "纸张" : theme === "green" ? "护眼" : "夜间"}</button>)}</div><span className="reader-setting-label">字号 <output>{preferences.fontSize}px</output></span><input aria-label="字号" type="range" min="15" max="30" value={preferences.fontSize} onChange={(event) => updateTypography({ fontSize: Number(event.target.value) })}/><span className="reader-setting-label">行距 <output>{preferences.lineHeight.toFixed(1)}</output></span><input aria-label="行距" type="range" min="1.5" max="2.3" step=".1" value={preferences.lineHeight} onChange={(event) => updateTypography({ lineHeight: Number(event.target.value) })}/>{preferences.readingMode === "page" && <><span className="reader-setting-label">翻页动画</span><div className="animation-options">{(["page", "slide", "none"] as const).map((animation) => <button key={animation} className={preferences.animation === animation ? "active" : ""} onClick={() => setPreferences({ ...preferences, animation })}>{animation === "page" ? "仿真" : animation === "slide" ? "滑动" : "无"}</button>)}</div></>}<p>进度、排版设置和已下载书籍都会保存在当前设备。</p></aside>}
    </div>
    <nav className="reader-mobile-toolbar" aria-label="阅读工具">
      <button aria-label={sidebarOpen ? "关闭目录" : "打开目录"} aria-expanded={sidebarOpen} onClick={toggleSidebar}><span aria-hidden="true">☰</span><small>目录</small></button>
      <button aria-label="搜索书内内容" aria-expanded={searchOpen} onClick={toggleSearch}><span aria-hidden="true">⌕</span><small>搜索</small></button>
      <button aria-label="添加书签" onClick={addBookmark}><span aria-hidden="true">☆</span><small>书签</small></button>
      <button aria-label="阅读设置" aria-expanded={settingsOpen} onClick={toggleSettings}><span aria-hidden="true">Aa</span><small>设置</small></button>
    </nav>
  </div>;
}
