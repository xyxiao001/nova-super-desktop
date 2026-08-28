"use client";

import type { DesktopItem } from "./desktopFiles";

export default function FolderViewApp({ folder, items, open, createText, createFolder, goBack, context }: {
  folder: DesktopItem;
  items: DesktopItem[];
  open: (item: DesktopItem) => void;
  createText: () => void;
  createFolder: () => void;
  goBack: () => void;
  context: (item: DesktopItem, x: number, y: number) => void;
}) {
  return <div className="folder-view">
    <header><div><button aria-label="返回上一级" onClick={goBack}>←</button><strong>{folder.name}</strong><button onClick={createFolder}>＋ 新建文件夹</button><button onClick={createText}>＋ 新建文本</button></div><span>{items.length} 个项目</span></header>
    {items.length ? <div className="folder-items">{items.map((item) => <button key={item.id} className="desktop-item" onDoubleClick={() => open(item)} onKeyDown={(event) => {
      if (event.key === "Enter") open(item);
    }} onContextMenu={(event) => {
      event.preventDefault();
      event.stopPropagation();
      context(item, event.clientX, event.clientY);
    }}>
      {item.type === "folder" ? <span className="folder-icon"><i/></span> : item.type === "text" ? <span className="text-icon"><b>TXT</b><i/><i/><i/></span> : <span className="image-icon" style={{ backgroundImage: `url(${item.content})` }}/>}
      <strong>{item.name}</strong>
    </button>)}</div> : <div className="app-empty"><span>▱</span><strong>{folder.name}是空的</strong><small>可以继续新建文件夹或文本文稿。</small></div>}
  </div>;
}
