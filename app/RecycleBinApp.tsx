"use client";

import "./productivity-apps.css";

import { useEffect, useState } from "react";

import type { DesktopItem } from "./desktopFiles";

export default function RecycleBinApp({ items, restore, remove, empty }: {
  items: DesktopItem[];
  restore: (ids: string[]) => void;
  remove: (ids: string[]) => void;
  empty: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ all: boolean; ids: string[] } | null>(null);
  useEffect(() => setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id))), [items]);
  const format = (value?: number) => value ? new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "";
  const allSelected = !!items.length && selectedIds.length === items.length;
  const toggle = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const restoreIds = (ids: string[]) => {
    restore(ids);
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.all) empty();
    else remove(pendingDelete.ids);
    setSelectedIds([]);
    setPendingDelete(null);
  };

  return <div className="recycle-bin">
    <header><div><strong>回收站</strong><span>{selectedIds.length ? `已选择 ${selectedIds.length} 个项目` : `${items.length} 个项目`}</span></div><section><label><input type="checkbox" aria-label="选择全部回收站项目" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : items.map((item) => item.id))}/> 全选</label><button disabled={!selectedIds.length} onClick={() => restoreIds(selectedIds)}>还原所选</button><button className="danger" disabled={!selectedIds.length} onClick={() => setPendingDelete({ all: false, ids: selectedIds })}>删除所选</button><button className="danger" disabled={!items.length} onClick={() => setPendingDelete({ all: true, ids: items.map((item) => item.id) })}>清空回收站</button></section></header>
    {items.length ? <div className="recycle-list">{items.map((item) => <article key={item.id} className={selectedIds.includes(item.id) ? "selected" : ""}><label><input type="checkbox" aria-label={`选择${item.name}`} checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)}/></label><span className={`recycle-file-icon ${item.type}`}>{item.type === "image" ? <i style={{ backgroundImage: `url(${item.content})` }}/> : item.type === "folder" ? "▱" : "TXT"}</span><div><strong>{item.name}</strong><small>删除时间：{format(item.deletedAt)}</small></div><button onClick={() => restoreIds([item.id])}>还原</button><button className="permanent-delete" onClick={() => setPendingDelete({ all: false, ids: [item.id] })}>永久删除</button></article>)}</div> : <div className="app-empty"><span>▥</span><strong>回收站为空</strong><small>从桌面删除的文件会暂时保存在这里。</small></div>}
    {pendingDelete && <div className="recycle-confirm-layer"><section role="dialog" aria-modal="true" aria-label="确认永久删除"><strong>{pendingDelete.all ? "清空回收站？" : `永久删除 ${pendingDelete.ids.length} 个项目？`}</strong><p>删除后无法通过回收站恢复。</p><div><button onClick={() => setPendingDelete(null)}>取消</button><button className="danger" onClick={confirmDelete}>永久删除</button></div></section></div>}
  </div>;
}
