"use client";

import { useEffect, useRef, useState } from "react";
import type { EpubExcerptSource, ReaderExcerptSource } from "../../../app/readerExcerptSource";
import { publishNovaActivityEvent, readingMilestoneForProgress } from "../../../app/activityEvents";
import { readerExcerpt, type ReaderPreferences, type StoredBook } from "./readerCore";
import { decodeEpub, type EpubBookmark, type EpubEngine, type EpubLocation, type EpubSearchResult, type EpubSelection, type EpubTocItem } from "./epubCore";
import { readEpubLocation, readReaderBookmarks, saveEpubLocation, saveReaderActivity, saveReaderBookmarks } from "./readerPersistence";
import ReaderCompanion from "./ReaderCompanion";

type Props = {
  book: StoredBook;
  source?: EpubExcerptSource;
  active: boolean;
  preferences: ReaderPreferences;
  onPreferences: (preferences: ReaderPreferences) => void;
  onBack: () => void;
  onCreateExcerpt: (excerpt: { title: string; content: string; readerSource?: ReaderExcerptSource }) => void;
};

function Toc({ items, current, onGo, depth = 0 }: { items: EpubTocItem[]; current?: string | null; onGo: (href: string) => void; depth?: number }) {
  return <>{items.map((item) => <div key={item.href}>
    <button className={current === item.href ? "active" : ""} style={{ paddingInlineStart: 12 + depth * 16 }} onClick={() => onGo(item.href)}>{item.label}</button>
    {item.subitems && <Toc items={item.subitems} current={current} onGo={onGo} depth={depth + 1} />}
  </div>)}</>;
}

export default function EpubReader({ book, source, active, preferences, onPreferences, onBack, onCreateExcerpt }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const engineRef = useRef<EpubEngine | null>(null);
  const latestRef = useRef({ preferences, active });
  latestRef.current = { preferences, active };
  const [location, setLocation] = useState(() => readEpubLocation(book.id));
  const initialLocation = useRef(location);
  const locationRef = useRef<EpubLocation | null>(location);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousProgress = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const [toc, setToc] = useState<EpubTocItem[]>([]);
  const [ready, setReady] = useState(false);
  const [fixedLayout, setFixedLayout] = useState(false);
  const [panel, setPanel] = useState<"chapters" | "bookmarks" | "search" | "settings" | null>(null);
  const [bookmarks, setBookmarks] = useState(() => readReaderBookmarks<EpubBookmark>(book.id));
  const [selection, setSelection] = useState<EpubSelection | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EpubSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const progress = location ? Math.round(location.fraction * 100) : 0;

  const persistLocation = () => {
    const current = locationRef.current;
    if (!current) return;
    saveEpubLocation(book.id, current);
    saveReaderActivity({ bookId: book.id, title: book.title, author: book.author,
      progress: Math.round(current.fraction * 100), lastReadAt: Date.now() });
  };

  useEffect(() => {
    mountedRef.current = true;
    window.addEventListener("pagehide", persistLocation);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      persistLocation();
      window.removeEventListener("pagehide", persistLocation);
      engineRef.current?.close();
      engineRef.current = null;
    };
  }, [book.id]);

  useEffect(() => {
    if (ready) engineRef.current?.configure(preferences);
  }, [preferences, ready]);
  useEffect(() => {
    engineRef.current?.setActive(active);
  }, [active]);

  const open = async () => {
    const engine = (frameRef.current!.contentWindow as Window & { novaEpub: EpubEngine }).novaEpub;
    engineRef.current = engine;
    try {
      const result = await engine.open({
        bytes: decodeEpub(book.content), preferences: latestRef.current.preferences,
        cfi: source?.cfi ?? initialLocation.current?.cfi, active: latestRef.current.active,
        onLocation: (next) => {
          if (!mountedRef.current) return;
          locationRef.current = next;
          setLocation(next);
          const percent = Math.round(next.fraction * 100);
          if (previousProgress.current !== null) {
            const milestone = readingMilestoneForProgress(previousProgress.current, percent);
            if (milestone) publishNovaActivityEvent("reading-milestone", "reader", { localResourceId: book.id, progressBucket: milestone });
          }
          previousProgress.current = Math.max(previousProgress.current ?? percent, percent);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(persistLocation, 700);
        },
        onSelection: setSelection,
        onError: setMessage,
      });
      if (!mountedRef.current) return;
      setToc(result.toc);
      setFixedLayout(result.fixedLayout);
      setReady(true);
    } catch {
      if (mountedRef.current) setMessage(`“${book.title}”解析失败`);
    }
  };

  const run = (action: (engine: EpubEngine) => Promise<unknown>) => {
    const engine = engineRef.current;
    if (!ready || !engine) return;
    void action(engine).catch(() => setMessage(`“${book.title}”阅读操作失败`));
  };
  const goTo = (target: string) => {
    run((engine) => engine.goTo(target));
    setPanel(null);
    setSelection(null);
  };
  const togglePanel = (next: typeof panel) => setPanel(panel === next ? null : next);
  const addBookmark = () => {
    if (!location || bookmarks.some((item) => item.cfi === location.cfi)) return;
    const next = [{ ...location, id: crypto.randomUUID(), bookId: book.id, createdAt: Date.now() }, ...bookmarks];
    setBookmarks(next);
    saveReaderBookmarks(book.id, next);
    setPanel("bookmarks");
  };
  const removeBookmark = (id: string) => {
    const next = bookmarks.filter((item) => item.id !== id);
    setBookmarks(next);
    saveReaderBookmarks(book.id, next);
  };
  const createExcerpt = () => {
    if (!selection) return;
    const source: EpubExcerptSource = { format: "epub", bookId: book.id, bookTitle: book.title,
      bookVersion: book.version, chapterTitle: selection.chapterTitle, cfi: selection.cfi };
    onCreateExcerpt(readerExcerpt(book.title, selection.chapterTitle, selection.text, source));
    engineRef.current!.clearSelection();
    setSelection(null);
  };

  useEffect(() => {
    if (panel !== "search" || !query.trim() || !ready) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void engineRef.current!.search(query).then((items) => {
        if (!cancelled) setResults(items);
      }).catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 260);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [panel, query, ready]);

  const sidebarOpen = panel === "chapters" || panel === "bookmarks";
  return <div className={`reader-reading reader-epub theme-${preferences.theme}`}>
    <header className="reader-toolbar">
      <div className="reader-toolbar-navigation"><button aria-label="返回书架" onClick={() => { persistLocation(); onBack(); }}>←<span className="reader-toolbar-label">书架</span></button><button aria-label="打开目录" aria-expanded={sidebarOpen} onClick={() => togglePanel("chapters")}>☰</button></div>
      <div className="reader-book-heading"><strong>{book.title}</strong><small>{location?.chapterTitle}</small></div>
      <div className="reader-toolbar-actions">
        <button aria-label="摘录到记事本" disabled={!selection} onClick={createExcerpt}>✎</button>
        <button aria-label="搜索书内内容" aria-expanded={panel === "search"} disabled={!ready} onClick={() => togglePanel("search")}>⌕</button>
        <button aria-label="添加书签" disabled={!ready} onClick={addBookmark}>☆</button>
        <span className="reader-toolbar-progress">{progress}%</span>
        <button aria-label="阅读设置" aria-expanded={panel === "settings"} onClick={() => togglePanel("settings")}>Aa</button>
      </div>
    </header>
    <div className="reader-body">
      {panel && <button className={sidebarOpen ? "reader-sidebar-scrim" : "reader-panel-scrim"} aria-label="关闭阅读面板" onClick={() => setPanel(null)} />}
      {sidebarOpen && <aside className="reader-chapters"><header><div><button className={panel === "chapters" ? "active" : ""} onClick={() => setPanel("chapters")}>目录</button><button className={panel === "bookmarks" ? "active" : ""} onClick={() => setPanel("bookmarks")}>书签</button></div><button aria-label="关闭目录" onClick={() => setPanel(null)}>×</button></header>
        {panel === "chapters" ? <div><Toc items={toc} current={location?.href} onGo={goTo} /></div> : <div className="reader-bookmarks">{bookmarks.map((item) => <article key={item.id}><button onClick={() => goTo(item.cfi)}><strong>{item.chapterTitle}</strong><span>{item.excerpt}</span></button><button aria-label="删除书签" onClick={() => removeBookmark(item.id)}>×</button></article>)}{!bookmarks.length && <p>还没有书签</p>}</div>}
      </aside>}
      <main className="reader-epub-stage">
        <iframe ref={frameRef} title={`${book.title} EPUB 正文`} src="/reader/index.html" onLoad={() => void open()} />
        {!ready && !message && <div className="reader-epub-loading">正在打开 EPUB…</div>}
        <footer className="reader-epub-navigation"><button aria-label="上一页" disabled={!ready} onClick={() => run((engine) => engine.prev())}>←</button><span>{progress}%</span><button aria-label="下一页" disabled={!ready} onClick={() => run((engine) => engine.next())}>→</button></footer>
      </main>
      <ReaderCompanion bookId={book.id} active={active} />
      {panel === "search" && <aside className="reader-search-panel"><header><label><input aria-label="搜索书内内容" placeholder="搜索当前书籍" value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) { setResults([]); setSearching(false); } }} /></label><button aria-label="关闭搜索" onClick={() => setPanel(null)}>×</button></header><div>{searching ? <p>正在搜索…</p> : results.map((item) => <button key={item.cfi} onClick={() => goTo(item.cfi)}><strong>{item.label}</strong><span>{item.excerpt}</span></button>)}{query && !searching && !results.length && <p>没有找到相关内容</p>}</div></aside>}
      {panel === "settings" && <aside className="reader-settings"><header><strong>阅读设置</strong><button aria-label="关闭阅读设置" onClick={() => setPanel(null)}>×</button></header>
        {!fixedLayout && <><span className="reader-setting-label">阅读方式</span><div className="reading-mode-options">{(["scroll", "page"] as const).map((mode) => <button key={mode} className={preferences.readingMode === mode ? "active" : ""} onClick={() => onPreferences({ ...preferences, readingMode: mode })}>{mode === "scroll" ? "上下滚动" : "左右翻页"}</button>)}</div></>}
        <span className="reader-setting-label">阅读背景</span><div className="theme-options">{(["paper", "green", "night"] as const).map((theme) => <button key={theme} className={`${theme} ${preferences.theme === theme ? "active" : ""}`} onClick={() => onPreferences({ ...preferences, theme })}>{theme === "paper" ? "纸张" : theme === "green" ? "护眼" : "夜间"}</button>)}</div>
        {!fixedLayout && <><span className="reader-setting-label">字号 <output>{preferences.fontSize}px</output></span><input aria-label="字号" type="range" min="15" max="30" value={preferences.fontSize} onChange={(event) => onPreferences({ ...preferences, fontSize: Number(event.target.value) })} /><span className="reader-setting-label">行距 <output>{preferences.lineHeight.toFixed(1)}</output></span><input aria-label="行距" type="range" min="1.5" max="2.3" step=".1" value={preferences.lineHeight} onChange={(event) => onPreferences({ ...preferences, lineHeight: Number(event.target.value) })} /></>}
        {!fixedLayout && preferences.readingMode === "page" && <><span className="reader-setting-label">翻页动画</span><div className="animation-options">{(["slide", "none"] as const).map((animation) => <button key={animation} className={preferences.animation === animation ? "active" : ""} onClick={() => onPreferences({ ...preferences, animation })}>{animation === "slide" ? "滑动" : "无"}</button>)}</div></>}
        <p>{fixedLayout ? "本书使用固定版式，保留原书排版。" : "保留原书图文与目录；进度保存在当前设备。"}</p>
      </aside>}
    </div>
    <nav className="reader-mobile-toolbar" aria-label="阅读工具">
      <button aria-label="打开目录" onClick={() => togglePanel("chapters")}><span>☰</span><small>目录</small></button>
      <button aria-label="搜索书内内容" disabled={!ready} onClick={() => togglePanel("search")}><span>⌕</span><small>搜索</small></button>
      <button aria-label="添加书签" disabled={!ready} onClick={addBookmark}><span>☆</span><small>书签</small></button>
      <button aria-label="阅读设置" onClick={() => togglePanel("settings")}><span>Aa</span><small>设置</small></button>
      <button aria-label="摘录到记事本" disabled={!selection} onClick={createExcerpt}><span>✎</span><small>摘录</small></button>
    </nav>
    {message && <div className="reader-message" role="status">{message}</div>}
  </div>;
}
