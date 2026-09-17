"use client";

import "./notes.css";

import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  useWindowInstance,
  useWindowRuntime,
  useWindowTitle,
} from "../../platform/windows/WindowRuntime";
import { allTextMatches, nextTextMatchIndex, type TextMatch } from "../../../app/textSearch";
import { useAppLaunchIntent } from "../../platform/launch/LaunchRuntime";
import { useWorkspaceRuntime } from "../../platform/workspace/WorkspaceRuntime";

const MarkdownPreview = lazy(() => import("./MarkdownPreview"));

export default function NotepadApp() {
  const {
    visibleItems,
    getSaveStatus,
    downloadItem,
    openReaderSource,
    createText: create,
    updateItem: update,
    removeNote: remove,
  } = useWorkspaceRuntime();
  const windowInstance = useWindowInstance();
  const { launchIntent, onLaunchHandled } = useAppLaunchIntent("notes");
  const { retargetInstance } = useWindowRuntime();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const items = visibleItems
    .filter((entry) => entry.type === "text")
    .sort((left, right) => right.createdAt - left.createdAt);
  const item = windowInstance.target?.kind === "text"
    ? items.find((entry) => entry.id === windowInstance.target?.itemId) ?? null
    : null;
  useWindowTitle("notes", item?.name ?? "记事本", true);
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(-1);
  const confirmDelete = !!item && pendingDeleteId === item.id;
  const search = query.trim().toLowerCase();
  const visible = search
    ? items.filter((note) => note.name.toLowerCase().includes(search) || note.content.toLowerCase().includes(search))
    : items;
  const formatDate = (value: number) => new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value));
  const lines = item?.content.split(/\r?\n/).length ?? 0;
  const saveStatus = item ? getSaveStatus(item) : "saved";
  const findMatches = item ? allTextMatches(item.content, findQuery) : [];
  const activeFindIndex = findMatches.length ? Math.max(0, Math.min(findIndex, findMatches.length - 1)) : -1;
  const selectMatch = (match: TextMatch, focusEditor = false) => {
    setViewMode("edit");
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      if (focusEditor) editor.focus();
      editor.setSelectionRange(match.start, match.end);
      const ratio = match.start / Math.max(1, item?.content.length ?? 0);
      editor.scrollTop = ratio * Math.max(0, editor.scrollHeight - editor.clientHeight);
    });
  };
  const navigateFind = (direction: 1 | -1, focusEditor = false) => {
    const next = nextTextMatchIndex(activeFindIndex, findMatches.length, direction);
    setFindIndex(next);
    if (next >= 0) selectMatch(findMatches[next], focusEditor);
  };
  const updateFindQuery = (value: string) => {
    setFindQuery(value);
    const matches = item ? allTextMatches(item.content, value) : [];
    setFindIndex(matches.length ? 0 : -1);
    if (matches[0]) selectMatch(matches[0]);
  };
  const openFind = () => {
    setFindOpen(true);
    setViewMode("edit");
    requestAnimationFrame(() => { findInputRef.current?.focus(); findInputRef.current?.select(); });
  };
  const closeFind = () => {
    setFindOpen(false);
    editorRef.current?.focus();
  };
  useEffect(() => {
    setFindOpen(false);
    setFindQuery("");
    setFindIndex(-1);
    setViewMode("edit");
  }, [item?.id]);
  const handleWindowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openFind();
    }
  };
  useEffect(() => {
    if (!launchIntent || launchIntent.itemId !== item?.id) return;
    setViewMode("edit");
    const selection = launchIntent.selection;
    if (selection?.query) {
      setFindOpen(true);
      setFindQuery(selection.query);
      const matches = allTextMatches(item.content, selection.query);
      setFindIndex(matches.findIndex((match) => match.start === selection.start && match.end === selection.end));
    }
    const frame = requestAnimationFrame(() => {
      if (selection && selection.start >= 0 && selection.end <= item.content.length && selection.start < selection.end) {
        const editor = editorRef.current;
        editor?.focus();
        editor?.setSelectionRange(selection.start, selection.end);
        if (editor) {
          const ratio = selection.start / Math.max(1, item.content.length);
          editor.scrollTop = ratio * Math.max(0, editor.scrollHeight - editor.clientHeight);
        }
      }
      onLaunchHandled(launchIntent.requestId);
    });
    return () => cancelAnimationFrame(frame);
  }, [item, launchIntent, onLaunchHandled]);
  const createNote = () => {
    setPendingDeleteId(null);
    setMobileEditorOpen(true);
    create(null, windowInstance.id);
  };
  return <div className={`notepad-app ${mobileEditorOpen && item ? "mobile-editor-open" : ""}`} onKeyDown={handleWindowKeyDown}>
    <aside className="note-sidebar">
      <header><div><strong>文稿</strong><span>{items.length} 篇</span></div><button aria-label="新建文稿" title="新建文稿" onClick={createNote}>＋</button></header>
      <label className="note-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文稿" aria-label="搜索文稿"/></label>
      <div className="note-list">{visible.map((note) => {
        const preview = note.content.split(/\r?\n/).find((line) => line.trim())?.trim() || "空白文稿";
        return <button key={note.id} className={note.id === item?.id ? "active" : ""} aria-current={note.id === item?.id ? "page" : undefined} onClick={() => {
          setPendingDeleteId(null);
          setMobileEditorOpen(true);
          retargetInstance(windowInstance.id, { kind: "text", itemId: note.id });
        }}><strong>{note.name || "未命名.txt"}</strong><p>{preview}</p><span>{formatDate(note.createdAt)}</span></button>;
      })}{!visible.length && <div className="note-list-empty"><span>{search ? "⌕" : "▤"}</span><strong>{search ? "没有匹配的文稿" : "还没有文稿"}</strong></div>}</div>
    </aside>
    <section className="note-workspace">{item ? <>
      <header className="note-editor-header"><button className="note-mobile-back" aria-label="返回文稿列表" onClick={() => { setPendingDeleteId(null); setMobileEditorOpen(false); }}>‹</button><input aria-label="文件名" value={item.name} onChange={(event) => update(item.id, { name: event.target.value })}/><div><button className="note-find-button" aria-label="在当前文稿中查找" title="查找" onClick={openFind}>⌕</button><div className="note-view-toggle" role="group" aria-label="文稿视图"><button className={viewMode === "edit" ? "active" : ""} aria-pressed={viewMode === "edit"} onClick={() => setViewMode("edit")}>编辑</button><button className={viewMode === "preview" ? "active" : ""} aria-pressed={viewMode === "preview"} onClick={() => setViewMode("preview")}>预览</button></div><span className="note-save-status" role="status" data-state={saveStatus}>{saveStatus === "saved" ? "已保存到本机" : saveStatus === "saving" ? "保存中…" : "保存失败"}</span><button className={confirmDelete ? "confirm" : ""} aria-label={confirmDelete ? "确认删除文稿" : "删除文稿"} title={confirmDelete ? "再次点击移到回收站" : "删除文稿"} onClick={() => {
        if (confirmDelete) {
          remove(item.id);
          setPendingDeleteId(null);
          setMobileEditorOpen(false);
        } else {
          setPendingDeleteId(item.id);
        }
      }}>{confirmDelete ? "确认" : "⌫"}</button></div></header>
      {findOpen && <form className="note-find-bar" role="search" onSubmit={(event) => { event.preventDefault(); navigateFind(1); }}><label><span aria-hidden="true">⌕</span><input ref={findInputRef} value={findQuery} onChange={(event) => updateFindQuery(event.target.value)} onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => { if (event.key === "Escape") { event.preventDefault(); closeFind(); } else if (event.key === "Enter") { event.preventDefault(); navigateFind(event.shiftKey ? -1 : 1); } }} aria-label="在当前文稿中查找" placeholder="查找当前文稿"/></label><output aria-live="polite">{findMatches.length ? `${activeFindIndex + 1} / ${findMatches.length}` : "0 / 0"}</output><button type="button" aria-label="上一个匹配" disabled={!findMatches.length} onClick={() => navigateFind(-1)}>↑</button><button type="button" aria-label="下一个匹配" disabled={!findMatches.length} onClick={() => navigateFind(1)}>↓</button><button type="button" aria-label="关闭查找" onClick={closeFind}>×</button></form>}
      {saveStatus === "error" && <div className="note-save-error" role="alert"><span>内容尚未保存到本机，请先导出当前文稿，避免关闭或刷新后丢失。</span><button onClick={() => downloadItem(item)}>导出当前 TXT</button></div>}
      {item.readerSource && <div className="note-reader-source"><span>摘自《{item.readerSource.bookTitle}》 · {item.readerSource.chapterTitle}</span><button onClick={() => openReaderSource(item.readerSource!)}>返回原文</button></div>}
      {viewMode === "edit" ? <textarea ref={editorRef} key={item.id} aria-label="文本内容" autoFocus value={item.content} onChange={(event) => update(item.id, { content: event.target.value })} placeholder="开始记录…"/> : <Suspense fallback={<div className="note-markdown-loading">正在生成预览…</div>}><MarkdownPreview value={item.content}/></Suspense>}
      <footer><span>{lines} 行</span><span>{item.content.length} 字符</span><span>存储在桌面</span></footer>
    </> : <div className="note-welcome"><span aria-hidden="true">▤</span><strong>{items.length ? "选择一篇文稿" : "开始第一篇文稿"}</strong><p>{items.length ? "从左侧列表继续编辑，或新建一篇文稿。" : "文稿会实时保存，并作为 TXT 文件出现在桌面。"}</p><button onClick={createNote}>＋ 新建文稿</button></div>}</section>
  </div>;
}
