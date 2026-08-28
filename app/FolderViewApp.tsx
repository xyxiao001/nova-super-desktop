"use client";

import "./productivity-apps.css";

import { useEffect, useRef, type PointerEvent } from "react";

import type { DesktopItem } from "./desktopFiles";
import {
  DESKTOP_ICON_LONG_PRESS_MS,
  isCompactDesktopViewport,
  movedBeyondLongPressTolerance,
} from "./desktopIconInteraction";

export default function FolderViewApp({ folder, items, open, createText, createFolder, goBack, context }: {
  folder: DesktopItem;
  items: DesktopItem[];
  open: (item: DesktopItem) => void;
  createText: () => void;
  createFolder: () => void;
  goBack: () => void;
  context: (item: DesktopItem, x: number, y: number) => void;
}) {
  const pressRef = useRef<{ item: DesktopItem; x: number; y: number; timer: number } | null>(null);
  const longPressedIdRef = useRef<string | null>(null);
  const clearPress = () => {
    if (pressRef.current) window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  };
  const showContext = (item: DesktopItem, x: number, y: number) => {
    clearPress();
    longPressedIdRef.current = item.id;
    context(item, x, y);
  };
  const beginPress = (item: DesktopItem, event: PointerEvent<HTMLButtonElement>) => {
    if (!isCompactDesktopViewport() || event.button !== 0) return;
    clearPress();
    longPressedIdRef.current = null;
    const x = event.clientX;
    const y = event.clientY;
    pressRef.current = {
      item,
      x,
      y,
      timer: window.setTimeout(() => showContext(item, x, y), DESKTOP_ICON_LONG_PRESS_MS),
    };
  };
  const movePress = (event: PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (press && movedBeyondLongPressTolerance(
      { x: press.x, y: press.y },
      { x: event.clientX, y: event.clientY },
    )) clearPress();
  };
  useEffect(() => () => {
    if (pressRef.current) window.clearTimeout(pressRef.current.timer);
  }, []);

  return <div className="folder-view">
    <header><div><button aria-label="返回上一级" onClick={goBack}>←</button><strong>{folder.name}</strong><button onClick={createFolder}>＋ 新建文件夹</button><button onClick={createText}>＋ 新建文本</button></div><span>{items.length} 个项目</span></header>
    {items.length ? <div className="folder-items">{items.map((item) => <button key={item.id} className="desktop-item" onPointerDown={(event) => beginPress(item, event)} onPointerMove={movePress} onPointerUp={clearPress} onPointerCancel={clearPress} onClick={() => {
      if (!isCompactDesktopViewport()) return;
      if (longPressedIdRef.current === item.id) {
        longPressedIdRef.current = null;
        return;
      }
      open(item);
    }} onDoubleClick={() => {
      if (!isCompactDesktopViewport()) open(item);
    }} onKeyDown={(event) => {
      if (event.key === "Enter") open(item);
    }} onContextMenu={(event) => {
      event.preventDefault();
      event.stopPropagation();
      showContext(item, event.clientX, event.clientY);
    }}>
      {item.type === "folder" ? <span className="folder-icon"><i/></span> : item.type === "text" ? <span className="text-icon"><b>TXT</b><i/><i/><i/></span> : <span className="image-icon" style={{ backgroundImage: `url(${item.content})` }}/>}
      <strong>{item.name}</strong>
    </button>)}</div> : <div className="app-empty"><span>▱</span><strong>{folder.name}是空的</strong><small>可以继续新建文件夹或文本文稿。</small></div>}
  </div>;
}
