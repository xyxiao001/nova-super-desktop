"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { START_APP_GROUPS, type StartAppGroup } from "../src/platform/apps/appRegistry";

export type StartMenuAppEntry = {
  key: string;
  label: string;
  icon: string;
  kind: string;
  startPinned?: boolean;
  startGroup?: StartAppGroup;
  open: () => void;
};

export type StartMenuSearchResult = {
  key: string;
  label: string;
  icon: string;
  detail: string;
  open: () => void;
};

export default function StartMenu({
  mode,
  apps,
  searchQuery,
  searchIndex,
  searchResults,
  onSearchQueryChange,
  onSearchIndexChange,
  onRunSearchResult,
  onClose,
}: {
  mode: "launcher" | "search";
  apps: StartMenuAppEntry[];
  searchQuery: string;
  searchIndex: number;
  searchResults: StartMenuSearchResult[];
  onSearchQueryChange: (value: string) => void;
  onSearchIndexChange: (index: number) => void;
  onRunSearchResult: (index: number) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"pinned" | "all">("pinned");
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchText = searchQuery.trim();
  const pinnedApps = apps.filter((app) => app.startPinned);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const focusFirstApp = () => {
    contentRef.current?.querySelector<HTMLButtonElement>("[data-start-app]")?.focus();
  };
  const moveAppFocus = (event: KeyboardEvent<HTMLButtonElement>, columns: number) => {
    const buttons = Array.from(contentRef.current?.querySelectorAll<HTMLButtonElement>("[data-start-app]") ?? []);
    const index = buttons.indexOf(event.currentTarget);
    const resolvedColumns = columns || Math.max(
      1,
      getComputedStyle(event.currentTarget.parentElement!).gridTemplateColumns.split(" ").length,
    );
    const offsets: Partial<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -resolvedColumns,
      ArrowDown: resolvedColumns,
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, index + offset))]?.focus();
  };
  const renderIcon = (app: StartMenuAppEntry) => (
    <i className={`start-${app.kind}`} aria-hidden="true">{app.icon}</i>
  );

  return <section className={`start-menu ${mode === "search" ? "mobile-search-mode" : ""}`} role="dialog" aria-label={mode === "search" ? "搜索" : "开始菜单"}>
    <div className="start-search-row">
      <label className="start-search">
        <span aria-hidden="true">⌕</span>
        <input
          ref={searchRef}
          value={searchQuery}
          onChange={(event) => {
            onSearchQueryChange(event.target.value);
            onSearchIndexChange(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
              return;
            }
            if (!searchText && event.key === "ArrowDown") {
              event.preventDefault();
              focusFirstApp();
              return;
            }
            if (!searchText) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onSearchIndexChange(Math.max(0, Math.min(searchResults.length - 1, searchIndex + 1)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              onSearchIndexChange(Math.max(0, searchIndex - 1));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              onRunSearchResult(searchIndex);
            }
          }}
          placeholder="搜索应用、文件、书籍和设置"
        />
      </label>
      <button className="start-search-close" type="button" aria-label="关闭搜索" onClick={onClose}>×</button>
    </div>

    <div ref={contentRef} className="start-menu-content">
      {searchText ? <div className="start-results">
        <header><strong>搜索结果</strong><span>{searchResults.length} 项</span></header>
        {searchResults.map((result, index) => <button
          type="button"
          key={result.key}
          className={index === searchIndex ? "active" : ""}
          onPointerEnter={() => onSearchIndexChange(index)}
          onClick={() => onRunSearchResult(index)}
        ><i aria-hidden="true">{result.icon}</i><span><strong>{result.label}</strong><small>{result.detail}</small></span></button>)}
        {!searchResults.length && <p>没有找到“{searchQuery}”</p>}
      </div> : view === "pinned" ? <section className="start-pinned-view">
        <header className="start-section-header">
          <strong>{mode === "search" ? "建议" : "已固定"}</strong>
          {mode === "launcher" && <button type="button" onClick={() => setView("all")}>所有应用 <span aria-hidden="true">›</span></button>}
        </header>
        <div className="start-apps">
          {pinnedApps.map((app) => <button
            type="button"
            data-start-app
            key={app.key}
            onKeyDown={(event) => moveAppFocus(event, 0)}
            onClick={() => {
              app.open();
              onClose();
            }}
          >{renderIcon(app)}<span>{app.label}</span></button>)}
        </div>
      </section> : <section className="start-all-view">
        <header className="start-section-header">
          <button type="button" className="start-back" aria-label="返回已固定" title="返回已固定" onClick={() => setView("pinned")}>‹</button>
          <strong>所有应用</strong>
          <span>{apps.length} 个</span>
        </header>
        <div className="start-all-list">
          {START_APP_GROUPS.map((group) => {
            const groupApps = apps.filter((app) => app.startGroup === group.id);
            if (!groupApps.length) return null;
            return <section key={group.id}>
              <header><strong>{group.label}</strong><span>{groupApps.length}</span></header>
              {groupApps.map((app) => <button
                type="button"
                data-start-app
                key={app.key}
                onKeyDown={(event) => moveAppFocus(event, 1)}
                onClick={() => {
                  app.open();
                  onClose();
                }}
              >{renderIcon(app)}<span><strong>{app.label}</strong><small>应用</small></span><b aria-hidden="true">›</b></button>)}
            </section>;
          })}
        </div>
      </section>}
    </div>

    {mode === "launcher" && <footer>
      <span aria-hidden="true">◉</span>
      <strong>NOVA 用户</strong>
      <button type="button" aria-label="关闭开始菜单" title="关闭开始菜单" onClick={onClose}>⏻</button>
    </footer>}
  </section>;
}
