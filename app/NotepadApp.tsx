"use client";

import "./productivity-apps.css";

import { useState } from "react";

import type { DesktopItem } from "./desktopFiles";

export default function NotepadApp({ items, item, select, create, update, remove }: {
  items: DesktopItem[];
  item: DesktopItem | null;
  select: (id: string) => void;
  create: () => void;
  update: (id: string, patch: Partial<DesktopItem>) => void;
  remove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const confirmDelete = !!item && pendingDeleteId === item.id;
  const search = query.trim().toLowerCase();
  const visible = search
    ? items.filter((note) => note.name.toLowerCase().includes(search) || note.content.toLowerCase().includes(search))
    : items;
  const formatDate = (value: number) => new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value));
  const lines = item?.content.split(/\r?\n/).length ?? 0;
  const createNote = () => {
    setPendingDeleteId(null);
    setMobileEditorOpen(true);
    create();
  };
  return <div className={`notepad-app ${mobileEditorOpen && item ? "mobile-editor-open" : ""}`}>
    <aside className="note-sidebar">
      <header><div><strong>文稿</strong><span>{items.length} 篇</span></div><button aria-label="新建文稿" title="新建文稿" onClick={createNote}>＋</button></header>
      <label className="note-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文稿" aria-label="搜索文稿"/></label>
      <div className="note-list">{visible.map((note) => {
        const preview = note.content.split(/\r?\n/).find((line) => line.trim())?.trim() || "空白文稿";
        return <button key={note.id} className={note.id === item?.id ? "active" : ""} aria-current={note.id === item?.id ? "page" : undefined} onClick={() => {
          setPendingDeleteId(null);
          setMobileEditorOpen(true);
          select(note.id);
        }}><strong>{note.name || "未命名.txt"}</strong><p>{preview}</p><span>{formatDate(note.createdAt)}</span></button>;
      })}{!visible.length && <div className="note-list-empty"><span>{search ? "⌕" : "▤"}</span><strong>{search ? "没有匹配的文稿" : "还没有文稿"}</strong></div>}</div>
    </aside>
    <section className="note-workspace">{item ? <>
      <header className="note-editor-header"><button className="note-mobile-back" aria-label="返回文稿列表" onClick={() => { setPendingDeleteId(null); setMobileEditorOpen(false); }}>‹</button><input aria-label="文件名" value={item.name} onChange={(event) => update(item.id, { name: event.target.value })}/><div><span>已自动保存</span><button className={confirmDelete ? "confirm" : ""} aria-label={confirmDelete ? "确认删除文稿" : "删除文稿"} title={confirmDelete ? "再次点击移到回收站" : "删除文稿"} onClick={() => {
        if (confirmDelete) {
          remove(item.id);
          setPendingDeleteId(null);
          setMobileEditorOpen(false);
        } else {
          setPendingDeleteId(item.id);
        }
      }}>{confirmDelete ? "确认" : "⌫"}</button></div></header>
      <textarea key={item.id} aria-label="文本内容" autoFocus value={item.content} onChange={(event) => update(item.id, { content: event.target.value })} placeholder="开始记录…"/>
      <footer><span>{lines} 行</span><span>{item.content.length} 字符</span><span>存储在桌面</span></footer>
    </> : <div className="note-welcome"><span aria-hidden="true">▤</span><strong>{items.length ? "选择一篇文稿" : "开始第一篇文稿"}</strong><p>{items.length ? "从左侧列表继续编辑，或新建一篇文稿。" : "文稿会实时保存，并作为 TXT 文件出现在桌面。"}</p><button onClick={createNote}>＋ 新建文稿</button></div>}</section>
  </div>;
}
