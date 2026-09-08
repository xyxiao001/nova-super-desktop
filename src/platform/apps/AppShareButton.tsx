"use client";

import { useState } from "react";
import { APP_MANIFESTS, type WindowAppId } from "./appManifest";
import { appShareUrl, copyShareLink } from "./appShare";
import "./appShare.css";

export default function AppShareButton({ app }: { app: WindowAppId }) {
  const [link, setLink] = useState<string | null>(null);
  const [result, setResult] = useState<"copied" | "manual" | null>(null);
  const label = APP_MANIFESTS[app].label;
  return <div className="app-share-control" onDoubleClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setLink(null); } }}>
    <button type="button" className="app-share-trigger" aria-label={`分享${label}`} aria-expanded={link !== null} onClick={() => { setLink(link === null ? appShareUrl(app, location.origin) : null); setResult(null); }}>分享 ↗</button>
    {link !== null && <section className="app-share-panel" role="dialog" aria-label={`分享${label}链接`}>
      <header><strong>分享{label}</strong><button type="button" aria-label="关闭应用分享" onClick={() => setLink(null)}>×</button></header>
      <p>打开链接即可进入应用。本地文件和存档留在各自设备。</p>
      <input aria-label="应用分享链接" readOnly autoFocus value={link} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}/>
      <footer><a href={link} target="_blank" rel="noreferrer">打开链接 ↗</a><button type="button" onClick={async () => setResult(await copyShareLink(link))}>复制链接</button></footer>
      {result && <small role="status">{result === "copied" ? "链接已复制" : "请选择上方链接，按 Ctrl / ⌘ + C 复制。"}</small>}
    </section>}
  </div>;
}
