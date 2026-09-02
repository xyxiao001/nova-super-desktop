"use client";

import "./explorer.css";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import {
  useWindowInstance,
  useWindowRuntime,
  useWindowTitle,
} from "../../platform/windows/WindowRuntime";
import {
  descendantIds,
  NOVA_FILE_DRAG_TYPE,
  visibleDesktopItems,
  type DesktopItem,
} from "../../../app/desktopFiles";
import { fileOpenOptions } from "../../../app/fileAssociations";
import {
  DESKTOP_ICON_LONG_PRESS_MS,
  isCompactDesktopViewport,
  movedBeyondLongPressTolerance,
} from "../../../app/desktopIconInteraction";
import { useAppLaunchIntent } from "../../platform/launch/LaunchRuntime";
import { useWorkspaceRuntime } from "../../platform/workspace/WorkspaceRuntime";

type ExplorerLocation = "folder" | "recent" | "images" | "documents";
type SortMode = "name" | "type" | "date";
type ViewMode = "grid" | "list";
type SelectionBox = { left: number; top: number; width: number; height: number };

const locationLabels: Record<Exclude<ExplorerLocation, "folder">, string> = {
  recent: "最近使用",
  images: "图片",
  documents: "文稿",
};

const typeLabel = (item: DesktopItem) => (
  item.type === "folder" ? "文件夹" : item.type === "image" ? "图片" : "文本文稿"
);

const itemBytes = (item: DesktopItem) => {
  if (item.type === "folder") return 0;
  return item.type === "image"
    ? Math.max(0, Math.floor(item.content.length * .75))
    : new Blob([item.content]).size;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const itemSize = (item: DesktopItem) => (
  item.type === "folder" ? "—" : formatBytes(itemBytes(item))
);

const readDraggedIds = (event: DragEvent) => {
  try {
    const value = JSON.parse(event.dataTransfer.getData(NOVA_FILE_DRAG_TYPE));
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

function ItemIcon({ item }: { item: DesktopItem }) {
  if (item.type === "folder") return <span className="explorer-item-icon folder"><i /></span>;
  if (item.type === "image") {
    return <span className="explorer-item-icon image" style={{ backgroundImage: `url(${item.content})` }} />;
  }
  return <span className="explorer-item-icon text"><b>TXT</b><i /><i /></span>;
}

export default function FileExplorer() {
  const {
    items,
    clipboard,
    canUndo,
    openItem: onOpen,
    openItemWith: onOpenWith,
    openFolderWindow,
    createFolder: onCreateFolder,
    createText: onCreateText,
    renameItem: onRename,
    setClipboard: onSetClipboard,
    paste: onPaste,
    performFileOperation: onFileOperation,
    trashFromExplorer: onTrash,
    undoFileOperation: onUndo,
    openRecycleBin: onOpenRecycle,
  } = useWorkspaceRuntime();
  const windowInstance = useWindowInstance();
  const { retargetInstance } = useWindowRuntime();
  const folderId = windowInstance.target?.kind === "folder"
    ? windowInstance.target.itemId
    : null;
  const { launchIntent, onLaunchHandled } = useAppLaunchIntent("explorer");
  const [location, setLocation] = useState<ExplorerLocation>("folder");
  const [history, setHistory] = useState<(string | null)[]>([folderId]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const pendingNavigationRef = useRef<{ active: boolean; value: string | null }>({
    active: false,
    value: null,
  });
  const selectionAnchorRef = useRef<string | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const lassoRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLocalX: number;
    startLocalY: number;
    baseIds: string[];
  } | null>(null);
  const itemPressRef = useRef<{
    id: string;
    x: number;
    y: number;
    timer: number;
  } | null>(null);
  const longPressedItemRef = useRef<string | null>(null);

  const liveItems = useMemo(() => visibleDesktopItems(items), [items]);
  const currentFolder = folderId
    ? liveItems.find((item) => item.id === folderId && item.type === "folder") ?? null
    : null;
  useWindowTitle("explorer", currentFolder?.name ?? "文件资源管理器", true);

  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (pending.active && pending.value === folderId) {
      pending.active = false;
      return;
    }
    setLocation("folder");
    setHistory([folderId]);
    setHistoryIndex(0);
    setSelectedIds([]);
  }, [folderId]);

  useEffect(() => {
    if (folderId && !currentFolder) retargetInstance(windowInstance.id);
  }, [currentFolder, folderId, retargetInstance, windowInstance.id]);

  useEffect(() => {
    if (!launchIntent) return;
    onLaunchHandled(launchIntent.requestId);
    setLocation("folder");
    setQuery("");
    setSelectedIds([launchIntent.itemId]);
    selectionAnchorRef.current = launchIntent.itemId;
    requestAnimationFrame(() => {
      contentRef.current
        ?.querySelector<HTMLElement>(`[data-file-id="${CSS.escape(launchIntent.itemId)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }, [launchIntent, onLaunchHandled]);

  const requestNavigation = (next: string | null, mode: "push" | "history" = "push") => {
    setLocation("folder");
    setSelectedIds([]);
    setQuery("");
    setPropertiesOpen(false);
    pendingNavigationRef.current = { active: true, value: next };
    if (mode === "push") {
      setHistory((current) => [...current.slice(0, historyIndex + 1), next]);
      setHistoryIndex((current) => current + 1);
    }
    retargetInstance(
      windowInstance.id,
      next ? { kind: "folder", itemId: next } : undefined,
    );
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
    setSelectedIds((current) => current.filter((id) => (
      visibleItems.some((item) => item.id === id)
    )));
  }, [visibleItems]);

  const selectedItems = visibleItems.filter((item) => selectedIds.includes(item.id));
  const primarySelected = selectedItems.at(-1) ?? null;
  const activateItem = (item: DesktopItem) => {
    if (item.type === "folder") requestNavigation(item.id);
    else onOpen(item);
  };
  const clearItemPress = () => {
    if (itemPressRef.current) window.clearTimeout(itemPressRef.current.timer);
    itemPressRef.current = null;
  };
  const showItemContextMenu = (item: DesktopItem, clientX: number, clientY: number) => {
    clearItemPress();
    longPressedItemRef.current = item.id;
    if (!selectedIds.includes(item.id)) setSelectedIds([item.id]);
    selectionAnchorRef.current = item.id;
    const bounds = contentRef.current?.closest(".file-explorer")?.getBoundingClientRect();
    if (!bounds) return;
    setContextMenu({
      x: Math.min(clientX - bounds.left, bounds.width - 178),
      y: Math.min(clientY - bounds.top, bounds.height - 230),
    });
  };
  const beginItemPress = (item: DesktopItem, event: PointerEvent<HTMLButtonElement>) => {
    if (!isCompactDesktopViewport() || event.button !== 0) return;
    clearItemPress();
    longPressedItemRef.current = null;
    const x = event.clientX;
    const y = event.clientY;
    itemPressRef.current = {
      id: item.id,
      x,
      y,
      timer: window.setTimeout(
        () => showItemContextMenu(item, x, y),
        DESKTOP_ICON_LONG_PRESS_MS,
      ),
    };
  };
  const moveItemPress = (event: PointerEvent<HTMLButtonElement>) => {
    const press = itemPressRef.current;
    if (
      press
      && movedBeyondLongPressTolerance(
        { x: press.x, y: press.y },
        { x: event.clientX, y: event.clientY },
      )
    ) clearItemPress();
  };

  const openLocation = (next: ExplorerLocation) => {
    setLocation(next);
    setSelectedIds([]);
    setQuery("");
    setPropertiesOpen(false);
  };

  const selectItem = (item: DesktopItem, event: MouseEvent) => {
    if (event.shiftKey && selectionAnchorRef.current) {
      const from = visibleItems.findIndex((entry) => entry.id === selectionAnchorRef.current);
      const to = visibleItems.findIndex((entry) => entry.id === item.id);
      if (from >= 0 && to >= 0) {
        const range = visibleItems
          .slice(Math.min(from, to), Math.max(from, to) + 1)
          .map((entry) => entry.id);
        setSelectedIds((current) => (
          event.ctrlKey || event.metaKey
            ? [...new Set([...current, ...range])]
            : range
        ));
        return;
      }
    }
    selectionAnchorRef.current = item.id;
    if (event.ctrlKey || event.metaKey) {
      setSelectedIds((current) => (
        current.includes(item.id)
          ? current.filter((id) => id !== item.id)
          : [...current, item.id]
      ));
      return;
    }
    setSelectedIds([item.id]);
  };

  const currentTitle = location === "folder"
    ? currentFolder?.name ?? "桌面"
    : locationLabels[location];
  const canCreate = location === "folder";
  const parentFolder = currentFolder?.parentId ?? null;
  const excludedMoveIds = selectedItems
    .filter((item) => item.type === "folder")
    .reduce((result, item) => {
      for (const id of descendantIds(liveItems, [item.id])) result.add(id);
      return result;
    }, new Set<string>());
  const moveFolders = liveItems
    .filter((item) => item.type === "folder" && !excludedMoveIds.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  const beginMove = () => {
    if (!selectedItems.length) return;
    setContextMenu(null);
    setMoveTarget(
      selectedItems.every((item) => item.parentId === selectedItems[0].parentId)
        ? selectedItems[0].parentId ?? ""
        : "",
    );
    setMoveOpen(true);
  };

  const confirmMove = () => {
    if (!selectedItems.length) return;
    onFileOperation("move", selectedIds, moveTarget || null);
    setMoveOpen(false);
    setSelectedIds([]);
  };

  const writeDrag = (event: DragEvent, item: DesktopItem) => {
    const ids = selectedIds.includes(item.id) ? selectedIds : [item.id];
    if (!selectedIds.includes(item.id)) setSelectedIds(ids);
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData(NOVA_FILE_DRAG_TYPE, JSON.stringify(ids));
    event.dataTransfer.setData("text/plain", ids.join(","));
  };

  const dropFiles = (event: DragEvent, parentId: string | null) => {
    const ids = readDraggedIds(event);
    if (!ids.length) return;
    event.preventDefault();
    event.stopPropagation();
    onFileOperation(event.ctrlKey || event.metaKey ? "copy" : "move", ids, parentId);
    setDropTargetId(null);
    setSelectedIds([]);
  };

  const startLasso = (event: PointerEvent<HTMLElement>) => {
    if (
      isCompactDesktopViewport()
      ||
      event.button !== 0
      || (event.target as HTMLElement).closest(".explorer-items > button,.explorer-list-header")
    ) return;
    const content = contentRef.current;
    if (!content) return;
    const bounds = content.getBoundingClientRect();
    lassoRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLocalX: event.clientX - bounds.left + content.scrollLeft,
      startLocalY: event.clientY - bounds.top + content.scrollTop,
      baseIds: event.ctrlKey || event.metaKey ? selectedIds : [],
    };
    if (!event.ctrlKey && !event.metaKey) setSelectedIds([]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveLasso = (event: PointerEvent<HTMLElement>) => {
    const lasso = lassoRef.current;
    const content = contentRef.current;
    if (!lasso || !content) return;
    const bounds = content.getBoundingClientRect();
    const currentLocalX = event.clientX - bounds.left + content.scrollLeft;
    const currentLocalY = event.clientY - bounds.top + content.scrollTop;
    const left = Math.min(lasso.startLocalX, currentLocalX);
    const top = Math.min(lasso.startLocalY, currentLocalY);
    const width = Math.abs(currentLocalX - lasso.startLocalX);
    const height = Math.abs(currentLocalY - lasso.startLocalY);
    setSelectionBox({ left, top, width, height });
    const selectionRect = {
      left: Math.min(lasso.startClientX, event.clientX),
      top: Math.min(lasso.startClientY, event.clientY),
      right: Math.max(lasso.startClientX, event.clientX),
      bottom: Math.max(lasso.startClientY, event.clientY),
    };
    const intersected = [...content.querySelectorAll<HTMLElement>("[data-file-id]")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.right >= selectionRect.left
          && rect.left <= selectionRect.right
          && rect.bottom >= selectionRect.top
          && rect.top <= selectionRect.bottom
        );
      })
      .map((element) => element.dataset.fileId!)
      .filter(Boolean);
    setSelectedIds([...new Set([...lasso.baseIds, ...intersected])]);
  };

  const endLasso = (event: PointerEvent<HTMLElement>) => {
    if (!lassoRef.current) return;
    lassoRef.current = null;
    setSelectionBox(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  useEffect(() => () => {
    if (itemPressRef.current) window.clearTimeout(itemPressRef.current.timer);
  }, []);

  const selectedTreeIds = selectedItems.reduce((result, item) => {
    for (const id of descendantIds(liveItems, [item.id])) result.add(id);
    return result;
  }, new Set<string>());
  const selectedBytes = liveItems
    .filter((item) => selectedTreeIds.has(item.id))
    .reduce((total, item) => total + itemBytes(item), 0);
  const locationName = primarySelected?.parentId
    ? liveItems.find((item) => item.id === primarySelected.parentId)?.name ?? "桌面"
    : "桌面";

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
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedIds(visibleItems.map((item) => item.id));
      }
      if (command && event.key.toLowerCase() === "c" && selectedIds.length) {
        event.preventDefault();
        onSetClipboard("copy", selectedIds);
      }
      if (command && event.key.toLowerCase() === "x" && selectedIds.length) {
        event.preventDefault();
        onSetClipboard("move", selectedIds);
      }
      if (command && event.key.toLowerCase() === "v" && canCreate && clipboard) {
        event.preventDefault();
        onPaste(folderId);
      }
      if (command && event.key.toLowerCase() === "z" && canUndo) {
        event.preventDefault();
        onUndo();
      }
      if (event.key === "Enter" && primarySelected) activateItem(primarySelected);
      if (event.key === "F2" && selectedItems.length === 1) onRename(selectedItems[0]);
      if (event.key === "Delete" && selectedItems.length) setDeleteOpen(true);
      if (event.key === "Escape") {
        setContextMenu(null);
        setMoveOpen(false);
        setDeleteOpen(false);
        setPropertiesOpen(false);
        setSelectedIds([]);
      }
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
        <button aria-label="剪切" title="剪切" disabled={!selectedIds.length} onClick={() => onSetClipboard("move", selectedIds)}>✂</button>
        <button aria-label="复制" title="复制" disabled={!selectedIds.length} onClick={() => onSetClipboard("copy", selectedIds)}>⧉</button>
        <button aria-label="粘贴" title="粘贴" disabled={!canCreate || !clipboard} onClick={() => onPaste(folderId)}>▣</button>
        <button aria-label="撤销文件操作" title="撤销" disabled={!canUndo} onClick={onUndo}>↶</button>
        <button aria-label="重命名" title="重命名" disabled={selectedItems.length !== 1} onClick={() => primarySelected && onRename(primarySelected)}>✎</button>
        <button aria-label="移动到" title="移动到" disabled={!selectedIds.length} onClick={beginMove}>↪</button>
        <button aria-label="属性" title="属性" disabled={!selectedIds.length} onClick={() => setPropertiesOpen(true)}>ⓘ</button>
        <button className="danger" aria-label="移到回收站" title="移到回收站" disabled={!selectedIds.length} onClick={() => setDeleteOpen(true)}>⌫</button>
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

    <div className={`explorer-layout ${propertiesOpen ? "properties-open" : ""}`}>
      <aside className="explorer-sidebar">
        <button
          className={location === "folder" && folderId === null ? "active" : ""}
          onClick={() => requestNavigation(null)}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(NOVA_FILE_DRAG_TYPE)) event.preventDefault();
          }}
          onDrop={(event) => dropFiles(event, null)}
        ><i className="desktop-mark">▦</i><span>桌面</span></button>
        <button className={location === "recent" ? "active" : ""} onClick={() => openLocation("recent")}><i>◷</i><span>最近使用</span></button>
        <button className={location === "images" ? "active" : ""} onClick={() => openLocation("images")}><i>▧</i><span>图片</span></button>
        <button className={location === "documents" ? "active" : ""} onClick={() => openLocation("documents")}><i>▤</i><span>文稿</span></button>
        <span />
        <button onClick={onOpenRecycle}><i>▥</i><span>回收站</span></button>
      </aside>

      <section
        ref={contentRef}
        className={`explorer-content ${viewMode}`}
        onPointerDown={startLasso}
        onPointerMove={moveLasso}
        onPointerUp={endLasso}
        onPointerCancel={endLasso}
        onDragOver={(event) => {
          if (canCreate && event.dataTransfer.types.includes(NOVA_FILE_DRAG_TYPE)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = event.ctrlKey || event.metaKey ? "copy" : "move";
          }
        }}
        onDrop={(event) => {
          if (canCreate && !(event.target as HTMLElement).closest("[data-file-id]")) {
            dropFiles(event, folderId);
          }
        }}
      >
        {viewMode === "list" && visibleItems.length > 0 && <header className="explorer-list-header"><span>名称</span><span>日期</span><span>类型</span><span>大小</span></header>}
        <div className="explorer-items">
          {visibleItems.map((item) => <button
            key={item.id}
            data-file-id={item.id}
            draggable
            aria-pressed={selectedIds.includes(item.id)}
            className={`${selectedIds.includes(item.id) ? "selected" : ""} ${clipboard?.mode === "move" && clipboard.ids.includes(item.id) ? "cut" : ""} ${dropTargetId === item.id ? "drop-target" : ""}`}
            onPointerDown={(event) => beginItemPress(item, event)}
            onPointerMove={moveItemPress}
            onPointerUp={clearItemPress}
            onPointerCancel={clearItemPress}
            onClick={(event) => {
              if (isCompactDesktopViewport()) {
                if (longPressedItemRef.current === item.id) {
                  longPressedItemRef.current = null;
                  return;
                }
                activateItem(item);
                return;
              }
              selectItem(item, event);
            }}
            onDoubleClick={() => {
              if (!isCompactDesktopViewport()) activateItem(item);
            }}
            onDragStart={(event) => {
              if (isCompactDesktopViewport()) {
                event.preventDefault();
                return;
              }
              writeDrag(event, item);
            }}
            onDragEnd={() => setDropTargetId(null)}
            onDragOver={(event) => {
              if (item.type !== "folder" || !event.dataTransfer.types.includes(NOVA_FILE_DRAG_TYPE)) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = event.ctrlKey || event.metaKey ? "copy" : "move";
              setDropTargetId(item.id);
            }}
            onDragLeave={() => setDropTargetId((current) => current === item.id ? null : current)}
            onDrop={(event) => {
              if (item.type === "folder") dropFiles(event, item.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              showItemContextMenu(item, event.clientX, event.clientY);
            }}
          >
            <ItemIcon item={item} />
            <strong>{item.name}</strong>
            <span className="item-date">{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(item.lastOpenedAt ?? item.createdAt)}</span>
            <span className="item-type">{typeLabel(item)}</span>
            <span className="item-size">{item.type === "folder" ? `${liveItems.filter((entry) => entry.parentId === item.id).length} 项` : itemSize(item)}</span>
          </button>)}
        </div>
        {selectionBox && <i className="explorer-selection-box" style={selectionBox} />}
        {!visibleItems.length && <div className="explorer-empty"><span>{query ? "⌕" : "▱"}</span><strong>{query ? "没有匹配的项目" : `${currentTitle}为空`}</strong><small>{query ? "尝试使用其他名称搜索" : canCreate ? "可以在工具栏中新建文件夹或文稿" : "此位置暂时没有内容"}</small></div>}
      </section>

      {propertiesOpen && <aside className="explorer-properties">
        <header><strong>属性</strong><button aria-label="关闭属性" onClick={() => setPropertiesOpen(false)}>×</button></header>
        <div className="properties-icon">{selectedItems.length === 1 && primarySelected ? <ItemIcon item={primarySelected} /> : <span>▦</span>}</div>
        <h3>{selectedItems.length === 1 ? primarySelected?.name : `${selectedItems.length} 个项目`}</h3>
        <dl>
          <div><dt>类型</dt><dd>{selectedItems.length === 1 && primarySelected ? typeLabel(primarySelected) : "多个项目"}</dd></div>
          <div><dt>位置</dt><dd>{selectedItems.length === 1 ? locationName : currentTitle}</dd></div>
          <div><dt>包含</dt><dd>{selectedTreeIds.size} 个项目</dd></div>
          <div><dt>大小</dt><dd>{formatBytes(selectedBytes)}</dd></div>
          {selectedItems.length === 1 && primarySelected && <div><dt>创建时间</dt><dd>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(primarySelected.createdAt)}</dd></div>}
        </dl>
      </aside>}
    </div>

    <footer className="explorer-status">
      <span>{visibleItems.length} 个项目</span>
      {!!selectedItems.length && <><i /><strong>已选择 {selectedItems.length} 个项目</strong><span>{formatBytes(selectedBytes)}</span></>}
      {clipboard && <><i /><span>{clipboard.mode === "move" ? "已剪切" : "已复制"} {clipboard.ids.length} 个项目</span></>}
    </footer>

    {contextMenu && primarySelected && <div className="explorer-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
      {selectedItems.length === 1 && <button onClick={() => { activateItem(primarySelected); setContextMenu(null); }}>打开</button>}
      {selectedItems.length === 1 && primarySelected.type === "folder" && <button className="desktop-new-window-command" onClick={() => { openFolderWindow(primarySelected); setContextMenu(null); }}>在新窗口中打开</button>}
      {selectedItems.length === 1 && fileOpenOptions(primarySelected.type).filter((option) => !option.primary).map((option) => <button key={option.app} onClick={() => { onOpenWith(primarySelected, option.app); setContextMenu(null); }}>使用{option.label}打开</button>)}
      <button onClick={() => { onSetClipboard("move", selectedIds); setContextMenu(null); }}>剪切</button>
      <button onClick={() => { onSetClipboard("copy", selectedIds); setContextMenu(null); }}>复制</button>
      {selectedItems.length === 1 && <button onClick={() => { onRename(primarySelected); setContextMenu(null); }}>重命名</button>}
      <button onClick={beginMove}>移动到…</button>
      <button onClick={() => { setPropertiesOpen(true); setContextMenu(null); }}>属性</button>
      <span />
      <button className="danger" onClick={() => { setDeleteOpen(true); setContextMenu(null); }}>移到回收站</button>
    </div>}

    {moveOpen && !!selectedItems.length && <div className="explorer-dialog-layer">
      <form onSubmit={(event) => { event.preventDefault(); confirmMove(); }}>
        <strong>移动 {selectedItems.length} 个项目</strong>
        <p>选择目标文件夹</p>
        <select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
          <option value="">桌面</option>
          {moveFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        <div><button type="button" onClick={() => setMoveOpen(false)}>取消</button><button type="submit">移动</button></div>
      </form>
    </div>}

    {deleteOpen && !!selectedItems.length && <div className="explorer-dialog-layer">
      <form onSubmit={(event) => {
        event.preventDefault();
        onTrash(selectedIds);
        setDeleteOpen(false);
        setSelectedIds([]);
      }}>
        <strong>移到回收站？</strong>
        <p>{selectedItems.length === 1 ? `“${selectedItems[0].name}”` : `${selectedItems.length} 个项目`}将保留在回收站中，可以稍后还原。</p>
        <div><button type="button" onClick={() => setDeleteOpen(false)}>取消</button><button className="danger" type="submit">移到回收站</button></div>
      </form>
    </div>}
  </div>;
}
