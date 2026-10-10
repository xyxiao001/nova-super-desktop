import { useState } from "react";
import { copyShareLink } from "../../platform/apps/appShare";
import type { RadioStation } from "./stations";
import { radioShareUrl } from "./sharing";

export default function RadioShare({ station }: { station: RadioStation }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<"copied" | "manual" | null>(null);
  const link = open ? radioShareUrl(station.id, location.origin) : "";
  return <div className="radio-share" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }}>
    <button className="radio-pin" aria-label={`分享${station.name}`} aria-expanded={open} onClick={() => { setOpen(!open); setResult(null); }}>分享电台 ↗</button>
    {open && <section className="radio-share-panel" role="dialog" aria-label="分享电台">
      <header><span>把这段声音，分享出去。</span><button aria-label="关闭电台分享" onClick={() => setOpen(false)}>×</button></header>
      <strong>{station.name}</strong><small>{station.location} · {station.category}</small>
      <p>朋友打开链接就能找到这座电台，轻点播放，一起收听。</p>
      <input aria-label="电台分享链接" autoFocus readOnly value={link} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} />
      <footer><a href={link} target="_blank" rel="noreferrer">打开链接 ↗</a><button onClick={async () => setResult(await copyShareLink(link))}>复制链接</button></footer>
      {result && <p role="status">{result === "copied" ? "链接已复制" : "选中链接，按 Ctrl / ⌘ + C 复制。"}</p>}
    </section>}
  </div>;
}
