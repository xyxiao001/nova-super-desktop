"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  chapterParagraphs,
  locationForOffset,
  READER_DATA_VERSION,
  type CatalogBook,
  type ReaderChapter,
  type ReaderLocation,
  type ReaderPreferences,
  type ReaderTheme,
  type ReadingMode,
  type StoredBook,
  type StoredBookSummary,
} from "./readerCore";
import {
  readReaderLocation,
  readReaderPreferences,
  removeReaderLocation,
  saveReaderLocation,
  saveReaderPreferences,
} from "./readerPersistence";
import {
  deleteStoredBook,
  getStoredBook,
  getStoredBookSummaries,
  summarizeStoredBook,
  storeBook,
} from "./readerStorage";
import ReaderWorker from "./reader.worker?worker";

type DownloadMetadata = Record<string, { version: string; downloadedAt: number }>;
type ReaderWorkerResult = { content: string; chapters: ReaderChapter[] };
type ReaderWorkerResponse = ReaderWorkerResult & { requestId: number; error?: string };

const DOWNLOADS_KEY = "nova-reader-downloads";
const READING_ANCHOR_OFFSET = 72;
const timestamp = Date.now;

function paginate(content: string, limit: number) {
  const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const pages: string[] = [];
  let page = "";
  const flush = () => { if (page) pages.push(page); page = ""; };
  for (const line of lines) {
    if (line.length > limit) {
      flush();
      for (let index = 0; index < line.length; index += limit) pages.push(line.slice(index, index + limit));
      continue;
    }
    if (page.length + line.length + 1 > limit) flush();
    page += `${page ? "\n" : ""}${line}`;
  }
  flush();
  return pages.length ? pages : [""];
}

const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export default function ReaderApp({ active }: { active: boolean }) {
  const [catalog, setCatalog] = useState<CatalogBook[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [downloads, setDownloads] = useState<DownloadMetadata>({});
  const [localBooks, setLocalBooks] = useState<StoredBookSummary[]>([]);
  const [downloading, setDownloading] = useState<Set<string>>(() => new Set());
  const [openingBookId, setOpeningBookId] = useState<string | null>(null);
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null);
  const [chapters, setChapters] = useState<ReaderChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [turn, setTurn] = useState<{ direction: "forward" | "back"; token: number }>({ direction: "forward", token: 0 });
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState<ReaderPreferences>(readReaderPreferences);
  const importRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerRequestRef = useRef(0);
  const workerPendingRef = useRef(new Map<number, { resolve: (result: ReaderWorkerResult) => void; reject: (error: Error) => void }>());
  const pendingLocationRef = useRef<ReaderLocation | null>(null);
  const semanticLocationRef = useRef({ paragraphIndex: 0, characterOffset: 0 });
  const progressSnapshotRef = useRef<{ bookId: string; location: ReaderLocation } | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const requestedBookRef = useRef<string | null>(null);

  const getReaderWorker = () => {
    if (workerRef.current) return workerRef.current;
    const worker = new ReaderWorker();
    worker.onmessage = (event: MessageEvent<ReaderWorkerResponse>) => {
      const pending = workerPendingRef.current.get(event.data.requestId);
      if (!pending) return;
      workerPendingRef.current.delete(event.data.requestId);
      if (event.data.error) pending.reject(new Error(event.data.error));
      else pending.resolve({ content: event.data.content, chapters: event.data.chapters });
    };
    worker.onerror = () => {
      for (const pending of workerPendingRef.current.values()) pending.reject(new Error("书籍解析失败"));
      workerPendingRef.current.clear();
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    workerRef.current = worker;
    return worker;
  };

  const processBookText = (input: { content: string } | { buffer: ArrayBuffer }) => {
    const worker = getReaderWorker();
    const requestId = ++workerRequestRef.current;
    return new Promise<ReaderWorkerResult>((resolve, reject) => {
      workerPendingRef.current.set(requestId, { resolve, reject });
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
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
  }, [downloads]);

  const chapter = chapters[chapterIndex];
  const chapterContent = useMemo(() => activeBook && chapter ? activeBook.content.slice(chapter.start, chapter.end) : "", [activeBook, chapter]);
  const paragraphs = useMemo(() => chapter ? chapterParagraphs(activeBook?.content ?? "", chapter) : [], [activeBook, chapter]);
  const paragraphSegments = useMemo(() => {
    const segments = [];
    for (let index = 0; index < paragraphs.length; index += 24) segments.push(paragraphs.slice(index, index + 24));
    return segments;
  }, [paragraphs]);
  const pageLimit = Math.max(160, Math.round(360 * (18 / preferences.fontSize) * (1.85 / preferences.lineHeight)));
  const pages = useMemo(() => paginate(chapterContent, pageLimit), [chapterContent, pageLimit]);
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const chapterProgress = preferences.readingMode === "scroll" ? scrollProgress : (safePageIndex + 1) / pages.length;
  const completedCharacters = useMemo(() => chapters.slice(0, chapterIndex).reduce((total, item) => total + item.characterCount, 0), [chapterIndex, chapters]);
  const totalCharacters = useMemo(() => chapters.reduce((total, item) => total + item.characterCount, 0), [chapters]);
  const progress = activeBook && totalCharacters ? Math.round(((completedCharacters + (chapter?.characterCount ?? 0) * chapterProgress) / totalCharacters) * 100) : 0;

  useEffect(() => {
    if (!activeBook || !chapter) return;
    const semantic = preferences.readingMode === "page"
      ? locationForOffset(paragraphs, Math.floor((safePageIndex / pages.length) * chapter.characterCount))
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
      progressTimerRef.current = null;
    }, 700);
    return () => {
      if (progressTimerRef.current) window.clearTimeout(progressTimerRef.current);
    };
  }, [activeBook, chapter, chapterIndex, pages.length, paragraphs, preferences.readingMode, safePageIndex, scrollProgress]);

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
  }, [activeBook, chapter, chapterIndex, preferences.fontSize, preferences.lineHeight, preferences.readingMode]);

  const activateBook = (book: StoredBook, parsed: ReaderChapter[]) => {
    const position = readReaderLocation(book.id, parsed);
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
    setMessage("");
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
        const response = await fetch(book.url);
        if (!response.ok) throw new Error(String(response.status));
        const result = await processBookText({ buffer: await response.arrayBuffer() });
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
    } catch {
      setMessage(`“${book.title}”下载失败，请稍后重试`);
    } finally {
      setDownloading((current) => { const next = new Set(current); next.delete(book.id); return next; });
    }
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
      removeReaderLocation(book.id);
      if (progressSnapshotRef.current?.bookId === book.id) progressSnapshotRef.current = null;
      setLocalBooks((current) => current.filter((item) => item.id !== book.id));
    } catch {
      setMessage(`“${book.title}”删除失败`);
    }
  };

  const removeCloudDownload = async (book: CatalogBook) => {
    try {
      await deleteStoredBook(book.id);
      removeReaderLocation(book.id);
      if (progressSnapshotRef.current?.bookId === book.id) progressSnapshotRef.current = null;
      setDownloads((current) => { const next = { ...current }; delete next[book.id]; return next; });
    } catch {
      setMessage(`“${book.title}”删除失败`);
    }
  };

  const animate = useCallback((direction: "forward" | "back") => setTurn((current) => ({ direction, token: current.token + 1 })), []);
  const resetScroll = useCallback(() => {
    pendingLocationRef.current = null;
    semanticLocationRef.current = { paragraphIndex: 0, characterOffset: 0 };
    setScrollProgress(0);
    if (stageRef.current) stageRef.current.scrollTop = 0;
  }, []);
  const nextPage = useCallback(() => {
    if (safePageIndex < pages.length - 1) setPageIndex(safePageIndex + 1);
    else if (chapterIndex < chapters.length - 1) { setChapterIndex(chapterIndex + 1); setPageIndex(0); resetScroll(); }
    else return;
    animate("forward");
  }, [animate, chapterIndex, chapters.length, pages.length, resetScroll, safePageIndex]);
  const previousPage = useCallback(() => {
    if (safePageIndex > 0) setPageIndex(safePageIndex - 1);
    else if (chapterIndex > 0) { const previousChapter = chapters[chapterIndex - 1]; const previousPages = paginate(activeBook?.content.slice(previousChapter.start, previousChapter.end) ?? "", pageLimit); setChapterIndex(chapterIndex - 1); setPageIndex(previousPages.length - 1); resetScroll(); }
    else return;
    animate("back");
  }, [activeBook, animate, chapterIndex, chapters, pageLimit, resetScroll, safePageIndex]);
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

  const selectChapter = (index: number) => { setChapterIndex(index); setPageIndex(0); resetScroll(); animate(index >= chapterIndex ? "forward" : "back"); };
  const setReadingMode = (readingMode: ReadingMode) => {
    if (readingMode === preferences.readingMode) return;
    if (readingMode === "scroll") {
      const nextProgress = safePageIndex / pages.length;
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
      setPageIndex(Math.min(pages.length - 1, Math.floor(scrollProgress * pages.length)));
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
    progressSnapshotRef.current = null;
    setActiveBook(null);
    setChapters([]);
    setSettingsOpen(false);
  };
  const pageAnimation = preferences.animation === "none" ? "" : `reader-${preferences.animation}-${turn.direction}`;

  if (!activeBook) return <div className="reader-library">
    <header className="reader-library-header"><div><span className="reader-brand">阅</span><div><strong>NOVA 阅读</strong><small>云端书架 · 本地书籍</small></div></div><div className="reader-library-actions"><label className="reader-import-button">＋ 导入 TXT<input ref={importRef} aria-label="选择要导入的TXT书籍" type="file" accept=".txt,text/plain" onChange={(event) => { void importBook(event.target.files?.[0]); event.target.value = ""; }}/></label><button className="reader-refresh-button" onClick={loadCatalog}>↻ 检查云端书库</button></div></header>
    <section className="reader-hero"><div><small>你的第一间数字书房</small><h2>让阅读回到安静的地方</h2><p>云端书籍按需下载，也可以导入设备上的 TXT。阅读进度和书籍都保存在当前设备。</p></div><span><b>{catalog.length + localBooks.length}</b> 本藏书</span></section>
    {!!localBooks.length && <><header className="reader-shelf-title"><strong>本地书籍</strong><span>{localBooks.length} 本</span></header><section className="reader-shelf reader-local-shelf">{localBooks.map((book) => <article className="reader-book-card" key={book.id}><button className="reader-book-open" disabled={openingBookId === book.id} onClick={() => void openBook(book)}><span className={`reader-cover cover-${book.cover}`}><i>LOCAL</i><strong>{book.title}</strong><small>{book.author}</small></span><span className="reader-book-info"><strong>{book.title}</strong><small>{book.author}</small><p>{book.description}</p><em className="downloaded">{openingBookId === book.id ? "正在整理章节…" : `继续阅读 · ${formatSize(book.size)}`}</em></span></button><button className="reader-book-delete" disabled={openingBookId === book.id} aria-label={`删除${book.title}`} title="删除本地书籍" onClick={() => void removeLocalBook(book)}>×</button></article>)}</section></>}
    <header className="reader-shelf-title"><strong>云端书库</strong><span>{catalog.length} 本</span></header>
    {catalogState === "loading" ? <div className="reader-state"><i/><strong>正在查看云端书库</strong></div> : catalogState === "error" ? <div className="reader-state"><strong>云端书库暂时不可用</strong><button onClick={loadCatalog}>重新检查</button></div> : <section className="reader-shelf">{catalog.map((book) => {
      const downloaded = downloads[book.id];
      const current = downloaded?.version === book.version;
      return <article className="reader-book-card" key={book.id}><button className="reader-book-open" onClick={() => downloadOrOpen(book)} disabled={downloading.has(book.id) || openingBookId === book.id}>
          <span className={`reader-cover cover-${book.cover}`}><i>NOVA</i><strong>{book.title}</strong><small>{book.author}</small></span>
          <span className="reader-book-info"><strong>{book.title}</strong><small>{book.author}</small><p>{book.description}</p><em className={current ? "downloaded" : "cloud"}>{downloading.has(book.id) ? "正在下载…" : openingBookId === book.id ? "正在整理章节…" : current ? `继续阅读 · ${formatSize(book.size)}` : downloaded ? "发现云端更新" : `云端 · ${formatSize(book.size)}`}</em></span>
        </button>{downloaded && <button className="reader-book-delete" disabled={downloading.has(book.id) || openingBookId === book.id} aria-label={`删除${book.title}下载`} title="删除下载，可重新下载" onClick={() => void removeCloudDownload(book)}>×</button>}</article>;
    })}</section>}
    {message && <div className="reader-message">{message}</div>}
  </div>;

  return <div className={`reader-reading theme-${preferences.theme} mode-${preferences.readingMode}`}>
    <header className="reader-toolbar"><div><button onClick={goLibrary}>← 书架</button><button onClick={() => setSidebarOpen(!sidebarOpen)}>☰ 目录</button></div><div className="reader-book-heading"><strong>{activeBook.title}</strong><small>{chapter?.title}</small></div><div><span>{progress}%</span><button onClick={() => setSettingsOpen(!settingsOpen)}>Aa</button></div></header>
    <div className="reader-body">
      {sidebarOpen && <aside className="reader-chapters"><header><strong>目录</strong><span>{chapters.length} 章</span></header><div>{chapters.map((item, index) => <button key={`${item.title}-${index}`} className={index === chapterIndex ? "active" : ""} onClick={() => selectChapter(index)}><span>{item.title}</span>{index === chapterIndex && <small>{preferences.readingMode === "scroll" ? `${Math.round(scrollProgress * 100)}%` : `${safePageIndex + 1}/${pages.length}`}</small>}</button>)}</div></aside>}
      <main key={`${activeBook.id}-${chapterIndex}-${preferences.readingMode}`} ref={stageRef} className={`reader-stage reader-stage-${preferences.readingMode}`} onScroll={updateScrollProgress}>
        <article key={`${chapterIndex}-${preferences.readingMode === "page" ? `${safePageIndex}-${turn.token}` : "scroll"}`} className={`reader-page ${preferences.readingMode === "page" ? pageAnimation : ""}`} style={{ fontSize: preferences.fontSize, lineHeight: preferences.lineHeight }}>
          <header><span>{activeBook.title}</span><span>{chapter?.title}</span></header>
          {(preferences.readingMode === "scroll" || safePageIndex === 0) && <h1>{chapter?.title}</h1>}
          <div className="reader-content">{preferences.readingMode === "scroll" ? paragraphSegments.map((segment, segmentIndex) => <section className="reader-paragraph-segment" data-reader-segment={segmentIndex} key={segmentIndex}>{segment.map((paragraph) => <p key={paragraph.index} data-reader-paragraph={paragraph.index}>{paragraph.text}</p>)}</section>) : pages[safePageIndex].split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          {preferences.readingMode === "scroll" && <nav className="reader-chapter-navigation" aria-label="章节切换"><button disabled={chapterIndex === 0} onClick={previousChapter}>← 上一章</button><span>第 {chapterIndex + 1} / {chapters.length} 章</span><button disabled={chapterIndex === chapters.length - 1} onClick={nextChapter}>下一章 →</button></nav>}
          <footer><span>{activeBook.author}</span><span>{preferences.readingMode === "scroll" ? `${Math.round(scrollProgress * 100)}%` : `${safePageIndex + 1} / ${pages.length}`}</span></footer>
        </article>
        {preferences.readingMode === "page" && <><button className="reader-turn-zone previous" aria-label="上一页" onClick={previousPage}>‹</button><button className="reader-turn-zone next" aria-label="下一页" onClick={nextPage}>›</button></>}
      </main>
      {settingsOpen && <aside className="reader-settings"><header><strong>阅读设置</strong><button aria-label="关闭阅读设置" onClick={() => setSettingsOpen(false)}>×</button></header><span className="reader-setting-label">阅读方式</span><div className="reading-mode-options"><button className={preferences.readingMode === "scroll" ? "active" : ""} onClick={() => setReadingMode("scroll")}>上下滚动</button><button className={preferences.readingMode === "page" ? "active" : ""} onClick={() => setReadingMode("page")}>左右翻页</button></div><span className="reader-setting-label">阅读背景</span><div className="theme-options">{(["paper", "green", "night"] as ReaderTheme[]).map((theme) => <button key={theme} className={`${theme} ${preferences.theme === theme ? "active" : ""}`} onClick={() => setPreferences({ ...preferences, theme })}>{theme === "paper" ? "纸张" : theme === "green" ? "护眼" : "夜间"}</button>)}</div><span className="reader-setting-label">字号 <output>{preferences.fontSize}px</output></span><input aria-label="字号" type="range" min="15" max="30" value={preferences.fontSize} onChange={(event) => updateTypography({ fontSize: Number(event.target.value) })}/><span className="reader-setting-label">行距 <output>{preferences.lineHeight.toFixed(1)}</output></span><input aria-label="行距" type="range" min="1.5" max="2.3" step=".1" value={preferences.lineHeight} onChange={(event) => updateTypography({ lineHeight: Number(event.target.value) })}/>{preferences.readingMode === "page" && <><span className="reader-setting-label">翻页动画</span><div className="animation-options">{(["page", "slide", "none"] as const).map((animation) => <button key={animation} className={preferences.animation === animation ? "active" : ""} onClick={() => setPreferences({ ...preferences, animation })}>{animation === "page" ? "仿真" : animation === "slide" ? "滑动" : "无"}</button>)}</div></>}<p>进度、排版设置和已下载书籍都会保存在当前设备。</p></aside>}
    </div>
  </div>;
}
