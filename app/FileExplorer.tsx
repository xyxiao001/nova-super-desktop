"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { descendantIds, visibleDesktopItems, type DesktopItem } from "./desktopFiles";

type ExplorerLocation = "folder" | "recent" | "images" | "documents";
type SortMode = "name" | "type" | "date";
type ViewMode = "grid" | "list";

type FileExplorerProps = {
  items: DesktopItem[];
  folderId: string | null;
  onNavigate: (folderId: string | null) => void;
  onOpen: (item: DesktopItem) => void;
  onCreateFolder: (parentId: string | null) => void;
  onCreateText: (parentId: string | null) => void;
  onRename: (item: DesktopItem) => void;
  onDuplicate: (item: DesktopItem) => void;
  onMove: (item: DesktopItem, parentId: string | null) => void;
  onTrash: (item: DesktopItem) => void;
  onOpenRecycle: () => void;
};

const locationLabels: Record<Exclude<ExplorerLocation, "folder">, string> = {
  recent: "最近使用",
  images: "图片",
  documents: "文稿",
};

const typeLabel = (item: DesktopItem) => (
  item.type === "folder" ? "文件夹" : item.type === "image" ? "图片" : "文本文稿"
);

const itemSize = (item: DesktopItem) => {
  if (item.type === "folder") return "—";
  const bytes = item.type === "image"
    ? Math.max(0, Math.floor(item.content.length * .75))
    : new Blob([item.content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

function ItemIcon({ item }: { item: DesktopItem }) {
  if (item.type === "folder") return <span className="explorer-item-icon folder"><i /></span>;
  if (item.type === "image") {
    return <span className="explorer-item-icon image" style={{ backgroundImage: `url(${item.content})` }} />;
  }
  return <span className="explorer-item-icon text"><b>TXT</b><i /><i /></span>;
}

export default function FileExplorer({
  items,
  folderId,
  onNavigate,
  onOpen,
  onCreateFolder,
  onCreateText,
  onRename,
  onDuplicate,
  onMove,
  onTrash,
  onOpenRecycle,
}: FileExplorerProps) {
  const [location, setLocation] = useState<ExplorerLocation>("folder");
  const [history, setHistory] = useState<(string | null)[]>([folderId]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const pendingNavigationRef = useRef<{ active: boolean; value: string | null }>({
    active: false,
    value: null,
  });

  const liveItems = useMemo(() => visibleDesktopItems(items), [items]);
  const currentFolder = folderId
    ? liveItems.find((item) => item.id === folderId && item.type === "folder") ?? null
    : null;
  const selected = selectedId
    ? liveItems.find((item) => item.id === selectedId) ?? null
    : null;

  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (pending.active && pending.value === folderId) {
      pending.active = false;
      return;
    }
    setLocation("folder");
    setHistory([folderId]);
    setHistoryIndex(0);
    setSelectedId(null);
  }, [folderId]);

  useEffect(() => {
    if (folderId && !currentFolder) onNavigate(null);
  }, [currentFolder, folderId, onNavigate]);

  const requestNavigation = (next: string | null, mode: "push" | "history" = "push") => {
    setLocation("folder");
    setSelectedId(null);
    setQuery("");
    pendingNavigationRef.current = { active: true, value: next };
    if (mode === "push") {
      setHistory((current) => [...current.slice(0, historyIndex + 1), next]);
      setHistoryIndex((current) => current + 1);
    }
    onNavigate(next);
  };

  const goHistory = (index: number) => {
    if (index < 0 || index >= history.length) return;
    const next = history[index] ?? null;
    setHistoryIndex(index);
    requestNavigation(next, "history");
  };

  const path = useMemo(() => {
    const result: DesktopItem[] = [];
    const visited = new Set<string>();
    let cursor = currentFolder;
    while (cursor && !visited.has(cursor.id)) {
      result.unshift(cursor);
      visited.add(cursor.id);
      cursor = cursor.parentId
        ? liveItems.find((item) => item.id === cursor?.parentId && item.type === "folder") ?? null
        : null;
    }
    return result;
  }, [currentFolder, liveItems]);

  const baseItems = useMemo(() => {
    if (location === "recent") {
      return [...liveItems]
        .filter((item) => item.type !== "folder")
        .sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt))
        .slice(0, 30);
    }
    if (location === "images") return liveItems.filter((item) => item.type === "image");
    if (location === "documents") return liveItems.filter((item) => item.type === "text");
    return liveItems.filter((item) => item.parentId === folderId);
  }, [folderId, liveItems, location]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = normalizedQuery
      ? baseItems.filter((item) => item.name.toLocaleLowerCase().includes(normalizedQuery))
      : [...baseItems];
    return filtered.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (b.type === "folder" && a.type !== "folder") return 1;
      if (sortMode === "date") return b.createdAt - a.createdAt;
      if (sortMode === "type") {
        return typeLabel(a).localeCompare(typeLabel(b), "zh-CN")
          || a.name.localeCompare(b.name, "zh-CN");
      }
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }, [baseItems, query, sortMode]);

  useEffect(() => {
    if (selectedId && !visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visibleItems]);

  const activateItem = (item: DesktopItem) => {
    if (item.type === "folder") requestNavigation(item.id);
    else onOpen(item);
  };

  const openLocation = (next: ExplorerLocation) => {
    setLocation(next);
    setSelectedId(null);
    setQuery("");
  };

  const currentTitle = location === "folder"
    ? currentFolder?.name ?? "桌面"
    : locationLabels[location];
  const canCreate = location === "folder";
  const parentFolder = currentFolder?.parentId ?? null;
  const excludedMoveIds = selected?.type === "folder"
    ? descendantIds(liveItems, [selected.id])
    : new Set<string>();
  const moveFolders = liveItems
    .filter((item) => item.type === "folder" && !excludedMoveIds.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  const beginMove = () => {
    if (!selected) return;
    setContextMenu(null);
    setMoveTarget(selected.parentId ?? "");
    setMoveOpen(true);
  };

  const confirmMove = () => {
    if (!selected) return;
    onMove(selected, moveTarget || null);
    setMoveOpen(false);
    setSelectedId(null);
  };

  return <div
    className="file-explorer"
    role="region"
    aria-label="文件资源管理器"
    tabIndex={0}
    onPointerDown={(event) => {
      if (!(event.target as HTMLElement).closest(".explorer-context-menu")) {
        setContextMenu(null);
      }
    }}
    onKeyDown={(event) => {
      if ((event.target as HTMLElement).matches("input,select")) return;
      if (event.key === "Enter" && selected) activateItem(selected);
      if (event.key === "F2" && selected) onRename(selected);
      if (event.key === "Delete" && selected) setDeleteOpen(true);
    }}
  >
    <header className="explorer-command-bar">
      <div className="explorer-history">
        <button aria-label="后退" title="后退" disabled={historyIndex === 0} onClick={() => goHistory(historyIndex - 1)}>←</button>
        <button aria-label="前进" title="前进" disabled={historyIndex >= history.length - 1} onClick={() => goHistory(historyIndex + 1)}>→</button>
        <button aria-label="向上一级" title="向上一级" disabled={location !== "folder" || folderId === null} onClick={() => requestNavigation(parentFolder)}>↑</button>
      </div>
      <div className="explorer-create-actions">
        <button disabled={!canCreate} onClick={() => onCreateFolder(folderId)}>＋ <span>新建文件夹</span></button>
        <button disabled={!canCreate} onClick={() => onCreateText(folderId)}>▤ <span>新建文稿</span></button>
      </div>
      <span className="explorer-command-separator" />
      <div className="explorer-item-actions">
        <button aria-label="重命名" title="重命名" disabled={!selected} onClick={() => selected && onRename(selected)}>✎</button>
        <button aria-label="复制副本" title="复制副本" disabled={!selected} onClick={() => selected && onDuplicate(selected)}>⧉</button>
        <button aria-label="移动到" title="移动到" disabled={!selected} onClick={beginMove}>↪</button>
        <button className="danger" aria-label="移到回收站" title="移到回收站" disabled={!selected} onClick={() => setDeleteOpen(true)}>⌫</button>
      </div>
      <div className="explorer-view-actions">
        <select aria-label="排序方式" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
          <option value="name">名称</option>
          <option value="type">类型</option>
          <option value="date">日期</option>
        </select>
        <button aria-label={viewMode === "list" ? "切换到网格视图" : "切换到列表视图"} title={viewMode === "list" ? "网格视图" : "列表视图"} onClick={() => setViewMode((current) => current === "list" ? "grid" : "list")}>{viewMode === "list" ? "▦" : "☷"}</button>
      </div>
    </header>

    <div className="explorer-address-row">
      <nav aria-label="当前位置">
        <button onClick={() => requestNavigation(null)}>桌面</button>
        {location === "folder" && path.map((folder) => <span key={folder.id}>› <button onClick={() => requestNavigation(folder.id)}>{folder.name}</button></span>)}
        {location !== "folder" && <span>› <strong>{locationLabels[location]}</strong></span>}
      </nav>
      <label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索“${currentTitle}”`} aria-label={`搜索${currentTitle}`} /></label>
    </div>

    <div className="explorer-layout">
      <aside className="explorer-sidebar">
        <button className={location === "folder" && folderId === null ? "active" : ""} onClick={() => requestNavigation(null)}><i className="desktop-mark">▦</i><span>桌面</span></button>
        <button className={location === "recent" ? "active" : ""} onClick={() => openLocation("recent")}><i>◷</i><span>最近使用</span></button>
        <button className={location === "images" ? "active" : ""} onClick={() => openLocation("images")}><i>▧</i><span>图片</span></button>
        <button className={location === "documents" ? "active" : ""} onClick={() => openLocation("documents")}><i>▤</i><span>文稿</span></button>
        <span />
        <button onClick={onOpenRecycle}><i>▥</i><span>回收站</span></button>
      </aside>

      <section className={`explorer-content ${viewMode}`} onPointerDown={(event) => {
        if (!(event.target as HTMLElement).closest(".explorer-items > button")) setSelectedId(null);
      }}>
        {viewMode === "list" && visibleItems.length > 0 && <header className="explorer-list-header"><span>名称</span><span>日期</span><span>类型</span><span>大小</span></header>}
        <div className="explorer-items">
          {visibleItems.map((item) => <button
            key={item.id}
            className={selectedId === item.id ? "selected" : ""}
            onClick={() => setSelectedId(item.id)}
            onDoubleClick={() => activateItem(item)}
            onContextMenu={(event) => {
              event.preventDefault();
              setSelectedId(item.id);
              const bounds = event.currentTarget.closest(".file-explorer")?.getBoundingClientRect();
              if (bounds) {
                setContextMenu({
                  x: Math.min(event.clientX - bounds.left, bounds.width - 178),
                  y: Math.min(event.clientY - bounds.top, bounds.height - 178),
                });
              }
            }}
          >
            <ItemIcon item={item} />
            <strong>{item.name}</strong>
            <span className="item-date">{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(item.lastOpenedAt ?? item.createdAt)}</span>
            <span className="item-type">{typeLabel(item)}</span>
            <span className="item-size">{item.type === "folder" ? `${liveItems.filter((entry) => entry.parentId === item.id).length} 项` : itemSize(item)}</span>
          </button>)}
        </div>
        {!visibleItems.length && <div className="explorer-empty"><span>{query ? "⌕" : "▱"}</span><strong>{query ? "没有匹配的项目" : `${currentTitle}为空`}</strong><small>{query ? "尝试使用其他名称搜索" : canCreate ? "可以在工具栏中新建文件夹或文稿" : "此位置暂时没有内容"}</small></div>}
      </section>
    </div>

    <footer className="explorer-status">
      <span>{visibleItems.length} 个项目</span>
      {selected && <><i /><strong>已选择 1 个项目</strong><span>{typeLabel(selected)} · {itemSize(selected)}</span></>}
    </footer>

    {contextMenu && selected && <div className="explorer-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
      <button onClick={() => { activateItem(selected); setContextMenu(null); }}>打开</button>
      <button onClick={() => { onRename(selected); setContextMenu(null); }}>重命名</button>
      <button onClick={() => { onDuplicate(selected); setContextMenu(null); }}>复制副本</button>
      <button onClick={beginMove}>移动到…</button>
      <span />
      <button className="danger" onClick={() => { setDeleteOpen(true); setContextMenu(null); }}>移到回收站</button>
    </div>}

    {moveOpen && selected && <div className="explorer-dialog-layer">
      <form onSubmit={(event) => { event.preventDefault(); confirmMove(); }}>
        <strong>移动“{selected.name}”</strong>
        <p>选择目标文件夹</p>
        <select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
          <option value="">桌面</option>
          {moveFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        <div><button type="button" onClick={() => setMoveOpen(false)}>取消</button><button type="submit" disabled={(moveTarget || null) === selected.parentId}>移动</button></div>
      </form>
    </div>}

    {deleteOpen && selected && <div className="explorer-dialog-layer">
      <form onSubmit={(event) => {
        event.preventDefault();
        onTrash(selected);
        setDeleteOpen(false);
        setSelectedId(null);
      }}>
        <strong>移到回收站？</strong>
        <p>“{selected.name}”将保留在回收站中，可以稍后还原。</p>
        <div><button type="button" onClick={() => setDeleteOpen(false)}>取消</button><button className="danger" type="submit">移到回收站</button></div>
      </form>
    </div>}
  </div>;
}
