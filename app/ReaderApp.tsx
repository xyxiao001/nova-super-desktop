"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { openDB, type DBSchema } from "idb";

type CatalogBook = {
  id: string;
  title: string;
  author: string;
  description: string;
  cover: string;
  file: string;
  url: string;
  size: number;
  version: string;
};
type StoredBook = CatalogBook & { content: string; downloadedAt: number; source?: "cloud" | "local" };
type Chapter = { title: string; content: string };
type ReaderTheme = "paper" | "green" | "night";
type ReadingMode = "scroll" | "page";
type ReaderPreferences = { theme: ReaderTheme; fontSize: number; lineHeight: number; readingMode: ReadingMode; animation: "page" | "slide" | "none" };
type DownloadMetadata = Record<string, { version: string; downloadedAt: number }>;
type ReadingProgress = { chapterIndex: number; pageIndex: number; scrollProgress?: number };

interface ReaderDatabase extends DBSchema {
  books: { key:string; value:StoredBook };
}

const DB_NAME = "nova-reader-library";
const BOOK_STORE = "books";
const DOWNLOADS_KEY = "nova-reader-downloads";
const PREFERENCES_KEY = "nova-reader-preferences";
const defaultPreferences: ReaderPreferences = { theme: "paper", fontSize: 18, lineHeight: 1.85, readingMode: "scroll", animation: "page" };

const openDatabase = () => openDB<ReaderDatabase>(DB_NAME, 1, { upgrade(database) { database.createObjectStore(BOOK_STORE, { keyPath: "id" }); } });

async function getStoredBook(id: string) {
  const database = await openDatabase();
  const book = await database.get(BOOK_STORE, id);
  database.close();
  return book;
}

async function storeBook(book: StoredBook) {
  const database = await openDatabase();
  await database.put(BOOK_STORE, book);
  database.close();
}

async function getStoredBooks() {
  const database = await openDatabase();
  const books = await database.getAll(BOOK_STORE);
  database.close();
  return books;
}

async function deleteStoredBook(id: string) {
  const database = await openDatabase();
  await database.delete(BOOK_STORE, id);
  database.close();
}

function parseChapters(content: string): Chapter[] {
  const normalized = content.replace(/\r\n?/g, "\n");
  const pattern = /^(?:第[零一二三四五六七八九十百千万〇两0-9]+(?:卷(?:\s+第[零一二三四五六七八九十百千万〇两0-9]+章)?|[章节回篇部])[^\n]{0,36}|序(?:章|言)?|前言|楔子|引子|后记|尾声)\s*$/gm;
  const matches = [...normalized.matchAll(pattern)];
  if (!matches.length) return [{ title: "全文", content: normalized.trim() }];
  const chapters: Chapter[] = [];
  if ((matches[0].index ?? 0) > 0) {
    const opening = normalized.slice(0, matches[0].index).trim();
    if (opening) chapters.push({ title: "开始", content: opening });
  }
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    chapters.push({ title: match[0].trim(), content: normalized.slice(start, end).trim() });
  });
  return chapters.filter((chapter) => chapter.content || chapter.title);
}

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
  const [localBooks, setLocalBooks] = useState<StoredBook[]>([]);
  const [downloading, setDownloading] = useState<Set<string>>(() => new Set());
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [turn, setTurn] = useState<{ direction: "forward" | "back"; token: number }>({ direction: "forward", token: 0 });
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState<ReaderPreferences>(() => {
    const saved = typeof window === "undefined" ? null : localStorage.getItem(PREFERENCES_KEY);
    return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
  });
  const importRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const pendingScrollProgress = useRef(0);
  const requestedBookRef = useRef<string | null>(null);

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
    void getStoredBooks().then((books) => {
      if (cancelled) return;
      setLocalBooks(books.filter((book) => book.source === "local"));
      setDownloads(Object.fromEntries(books.filter((book) => book.source !== "local").map((book) => [book.id, { version: book.version, downloadedAt: book.downloadedAt }])));
    }).catch(() => setMessage("本地书库读取失败"));
    return () => { cancelled = true; window.clearTimeout(catalogTimer); };
  }, []);

  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
  }, [downloads]);

  const chapter = chapters[chapterIndex];
  const pageLimit = Math.max(160, Math.round(360 * (18 / preferences.fontSize) * (1.85 / preferences.lineHeight)));
  const pages = useMemo(() => paginate(chapter?.content ?? "", pageLimit), [chapter, pageLimit]);
  const safePageIndex = Math.min(pageIndex, pages.length - 1);
  const chapterProgress = preferences.readingMode === "scroll" ? scrollProgress : (safePageIndex + 1) / pages.length;
  const progress = activeBook && chapters.length ? Math.round(((chapterIndex + chapterProgress) / chapters.length) * 100) : 0;

  useEffect(() => {
    if (!activeBook || !chapters.length) return;
    localStorage.setItem(`nova-reader-progress:${activeBook.id}`, JSON.stringify({ chapterIndex, pageIndex: safePageIndex, scrollProgress }));
  }, [activeBook, chapterIndex, chapters.length, safePageIndex, scrollProgress]);

  useLayoutEffect(() => {
    if (!activeBook || preferences.readingMode !== "scroll") return;
    const stage = stageRef.current;
    if (!stage) return;
    const available = Math.max(0, stage.scrollHeight - stage.clientHeight);
    stage.scrollTop = pendingScrollProgress.current * available;
  }, [activeBook, chapterIndex, preferences.readingMode]);

  const openBook = (book: StoredBook) => {
    const parsed = parseChapters(book.content);
    const saved = localStorage.getItem(`nova-reader-progress:${book.id}`);
    const position = saved ? JSON.parse(saved) as ReadingProgress : { chapterIndex: 0, pageIndex: 0 };
    pendingScrollProgress.current = position.scrollProgress ?? 0;
    setActiveBook(book);
    setChapters(parsed);
    setChapterIndex(Math.min(position.chapterIndex, Math.max(0, parsed.length - 1)));
    setPageIndex(Math.max(0, position.pageIndex));
    setScrollProgress(position.scrollProgress ?? 0);
    setMessage("");
  };

  const downloadOrOpen = async (book: CatalogBook) => {
    if (downloading.has(book.id)) return;
    requestedBookRef.current = book.id;
    setDownloading((current) => new Set(current).add(book.id));
    setMessage("");
    try {
      let stored = await getStoredBook(book.id);
      if (!stored || stored.version !== book.version) {
        const response = await fetch(book.url);
        if (!response.ok) throw new Error(String(response.status));
        stored = { ...book, content: await response.text(), downloadedAt: Date.now(), source: "cloud" };
        await storeBook(stored);
      }
      setDownloads((current) => ({ ...current, [book.id]: { version: stored.version, downloadedAt: stored.downloadedAt } }));
      if (requestedBookRef.current === book.id) openBook(stored);
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
      const content = await file.text();
      const title = file.name.replace(/\.txt$/i, "") || "未命名书籍";
      const book: StoredBook = { id: `local:${crypto.randomUUID()}`, title, author: "本地导入", description: `来自 ${file.name}`, cover: "slate", file: file.name, url: "", size: file.size, version: "local", content, downloadedAt: Date.now(), source: "local" };
      await storeBook(book);
      setLocalBooks((current) => [book, ...current]);
      openBook(book);
    } catch {
      setMessage(`“${file.name}”导入失败`);
    }
  };

  const removeLocalBook = async (book: StoredBook) => {
    try {
      await deleteStoredBook(book.id);
      localStorage.removeItem(`nova-reader-progress:${book.id}`);
      setLocalBooks((current) => current.filter((item) => item.id !== book.id));
    } catch {
      setMessage(`“${book.title}”删除失败`);
    }
  };

  const removeCloudDownload = async (book: CatalogBook) => {
    try {
      await deleteStoredBook(book.id);
      localStorage.removeItem(`nova-reader-progress:${book.id}`);
      setDownloads((current) => { const next = { ...current }; delete next[book.id]; return next; });
    } catch {
      setMessage(`“${book.title}”删除失败`);
    }
  };

  const animate = (direction: "forward" | "back") => setTurn((current) => ({ direction, token: current.token + 1 }));
  const resetScroll = () => {
    pendingScrollProgress.current = 0;
    setScrollProgress(0);
    if (stageRef.current) stageRef.current.scrollTop = 0;
  };
  const nextPage = () => {
    if (safePageIndex < pages.length - 1) setPageIndex(safePageIndex + 1);
    else if (chapterIndex < chapters.length - 1) { setChapterIndex(chapterIndex + 1); setPageIndex(0); resetScroll(); }
    else return;
    animate("forward");
  };
  const previousPage = () => {
    if (safePageIndex > 0) setPageIndex(safePageIndex - 1);
    else if (chapterIndex > 0) { const previousPages = paginate(chapters[chapterIndex - 1].content, pageLimit); setChapterIndex(chapterIndex - 1); setPageIndex(previousPages.length - 1); resetScroll(); }
    else return;
    animate("back");
  };
  const nextChapter = () => {
    if (chapterIndex >= chapters.length - 1) return;
    setChapterIndex(chapterIndex + 1);
    setPageIndex(0);
    resetScroll();
  };
  const previousChapter = () => {
    if (chapterIndex <= 0) return;
    setChapterIndex(chapterIndex - 1);
    setPageIndex(0);
    resetScroll();
  };

  useEffect(() => {
    if (!active || !activeBook) return;
    const keyboard = (event: KeyboardEvent) => {
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
  });

  const selectChapter = (index: number) => { setChapterIndex(index); setPageIndex(0); resetScroll(); animate(index >= chapterIndex ? "forward" : "back"); };
  const setReadingMode = (readingMode: ReadingMode) => {
    if (readingMode === preferences.readingMode) return;
    if (readingMode === "scroll") {
      const nextProgress = safePageIndex / pages.length;
      pendingScrollProgress.current = nextProgress;
      setScrollProgress(nextProgress);
    } else {
      setPageIndex(Math.min(pages.length - 1, Math.floor(scrollProgress * pages.length)));
    }
    setPreferences({ ...preferences, readingMode });
  };
  const updateScrollProgress = () => {
    if (preferences.readingMode !== "scroll") return;
    const stage = stageRef.current;
    if (!stage) return;
    const available = stage.scrollHeight - stage.clientHeight;
    setScrollProgress(available > 0 ? stage.scrollTop / available : 1);
  };
  const goLibrary = () => { setActiveBook(null); setChapters([]); setSettingsOpen(false); };
  const pageAnimation = preferences.animation === "none" ? "" : `reader-${preferences.animation}-${turn.direction}`;

  if (!activeBook) return <div className="reader-library">
    <header className="reader-library-header"><div><span className="reader-brand">阅</span><div><strong>NOVA 阅读</strong><small>云端书架 · 本地书籍</small></div></div><div className="reader-library-actions"><label className="reader-import-button">＋ 导入 TXT<input ref={importRef} aria-label="选择要导入的TXT书籍" type="file" accept=".txt,text/plain" onChange={(event) => { void importBook(event.target.files?.[0]); event.target.value = ""; }}/></label><button className="reader-refresh-button" onClick={loadCatalog}>↻ 检查云端书库</button></div></header>
    <section className="reader-hero"><div><small>你的第一间数字书房</small><h2>让阅读回到安静的地方</h2><p>云端书籍按需下载，也可以导入设备上的 TXT。阅读进度和书籍都保存在当前设备。</p></div><span><b>{catalog.length + localBooks.length}</b> 本藏书</span></section>
    {!!localBooks.length && <><header className="reader-shelf-title"><strong>本地书籍</strong><span>{localBooks.length} 本</span></header><section className="reader-shelf reader-local-shelf">{localBooks.map((book) => <article className="reader-book-card" key={book.id}><button className="reader-book-open" onClick={() => openBook(book)}><span className={`reader-cover cover-${book.cover}`}><i>LOCAL</i><strong>{book.title}</strong><small>{book.author}</small></span><span className="reader-book-info"><strong>{book.title}</strong><small>{book.author}</small><p>{book.description}</p><em className="downloaded">继续阅读 · {formatSize(book.size)}</em></span></button><button className="reader-book-delete" aria-label={`删除${book.title}`} title="删除本地书籍" onClick={() => void removeLocalBook(book)}>×</button></article>)}</section></>}
    <header className="reader-shelf-title"><strong>云端书库</strong><span>{catalog.length} 本</span></header>
    {catalogState === "loading" ? <div className="reader-state"><i/><strong>正在查看云端书库</strong></div> : catalogState === "error" ? <div className="reader-state"><strong>云端书库暂时不可用</strong><button onClick={loadCatalog}>重新检查</button></div> : <section className="reader-shelf">{catalog.map((book) => {
      const downloaded = downloads[book.id];
      const current = downloaded?.version === book.version;
      return <article className="reader-book-card" key={book.id}><button className="reader-book-open" onClick={() => downloadOrOpen(book)} disabled={downloading.has(book.id)}>
          <span className={`reader-cover cover-${book.cover}`}><i>NOVA</i><strong>{book.title}</strong><small>{book.author}</small></span>
          <span className="reader-book-info"><strong>{book.title}</strong><small>{book.author}</small><p>{book.description}</p><em className={current ? "downloaded" : "cloud"}>{downloading.has(book.id) ? "正在下载…" : current ? `继续阅读 · ${formatSize(book.size)}` : downloaded ? "发现云端更新" : `云端 · ${formatSize(book.size)}`}</em></span>
        </button>{downloaded && <button className="reader-book-delete" disabled={downloading.has(book.id)} aria-label={`删除${book.title}下载`} title="删除下载，可重新下载" onClick={() => void removeCloudDownload(book)}>×</button>}</article>;
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
          <div>{(preferences.readingMode === "scroll" ? chapter?.content ?? "" : pages[safePageIndex]).split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          {preferences.readingMode === "scroll" && <nav className="reader-chapter-navigation" aria-label="章节切换"><button disabled={chapterIndex === 0} onClick={previousChapter}>← 上一章</button><span>第 {chapterIndex + 1} / {chapters.length} 章</span><button disabled={chapterIndex === chapters.length - 1} onClick={nextChapter}>下一章 →</button></nav>}
          <footer><span>{activeBook.author}</span><span>{preferences.readingMode === "scroll" ? `${Math.round(scrollProgress * 100)}%` : `${safePageIndex + 1} / ${pages.length}`}</span></footer>
        </article>
        {preferences.readingMode === "page" && <><button className="reader-turn-zone previous" aria-label="上一页" onClick={previousPage}>‹</button><button className="reader-turn-zone next" aria-label="下一页" onClick={nextPage}>›</button></>}
      </main>
      {settingsOpen && <aside className="reader-settings"><header><strong>阅读设置</strong><button aria-label="关闭阅读设置" onClick={() => setSettingsOpen(false)}>×</button></header><span className="reader-setting-label">阅读方式</span><div className="reading-mode-options"><button className={preferences.readingMode === "scroll" ? "active" : ""} onClick={() => setReadingMode("scroll")}>上下滚动</button><button className={preferences.readingMode === "page" ? "active" : ""} onClick={() => setReadingMode("page")}>左右翻页</button></div><span className="reader-setting-label">阅读背景</span><div className="theme-options">{(["paper", "green", "night"] as ReaderTheme[]).map((theme) => <button key={theme} className={`${theme} ${preferences.theme === theme ? "active" : ""}`} onClick={() => setPreferences({ ...preferences, theme })}>{theme === "paper" ? "纸张" : theme === "green" ? "护眼" : "夜间"}</button>)}</div><span className="reader-setting-label">字号 <output>{preferences.fontSize}px</output></span><input aria-label="字号" type="range" min="15" max="30" value={preferences.fontSize} onChange={(event) => { setPreferences({ ...preferences, fontSize: Number(event.target.value) }); setPageIndex(0); }}/><span className="reader-setting-label">行距 <output>{preferences.lineHeight.toFixed(1)}</output></span><input aria-label="行距" type="range" min="1.5" max="2.3" step=".1" value={preferences.lineHeight} onChange={(event) => { setPreferences({ ...preferences, lineHeight: Number(event.target.value) }); setPageIndex(0); }}/>{preferences.readingMode === "page" && <><span className="reader-setting-label">翻页动画</span><div className="animation-options">{(["page", "slide", "none"] as const).map((animation) => <button key={animation} className={preferences.animation === animation ? "active" : ""} onClick={() => setPreferences({ ...preferences, animation })}>{animation === "page" ? "仿真" : animation === "slide" ? "滑动" : "无"}</button>)}</div></>}<p>进度、排版设置和已下载书籍都会保存在当前设备。</p></aside>}
    </div>
  </div>;
}
