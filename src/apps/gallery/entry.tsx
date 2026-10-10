"use client";

import { useState } from "react";
import DesktopWidget, { PinButton, useDesktopPin } from "../../platform/desktop/DesktopWidget";
import { useRemoteData } from "../shared/useRemoteData";
import { GALLERY_WORKS, FRAME_STYLES, dailyArtworkIndex, artworkUrl, type GalleryArtwork, type FrameStyle } from "./galleryData";
import "./gallery.css";

function ArtworkFrame({ artwork, title, frame }: { artwork: GalleryArtwork; title: string; frame: FrameStyle }) {
  // Use an app-specific CDN cache key: the unqualified URLs can cache responses without CORS headers.
  return <figure className={`gallery-frame frame-${frame}`}><div className="gallery-image-mat"><img crossOrigin="anonymous" src={`${artwork.primaryImageSmall}?source=nova`} alt={`${title} — ${artwork.artistDisplayName}`} /></div>{frame === "instant" && <figcaption>{title}</figcaption>}</figure>;
}

export default function GalleryApp() {
  const [index, setIndex] = useState(() => dailyArtworkIndex(new Date()));
  const [frame, setFrame] = useState<FrameStyle>("wood");
  const [revision, setRevision] = useState(0);
  const pin = useDesktopPin();
  const work = GALLERY_WORKS[index];
  const result = useRemoteData<GalleryArtwork>(artworkUrl(index), revision);
  const data = result.status === "ready" ? result.data : null;
  const previous = () => setIndex(value => (value + GALLERY_WORKS.length - 1) % GALLERY_WORKS.length);
  const next = () => setIndex(value => (value + 1) % GALLERY_WORKS.length);
  return <><main className="nova-gallery" aria-label="NOVA 美术馆">
    <header className="gallery-header"><div><strong>NOVA <span>美术馆</span></strong><small>A LITTLE ART, EVERY DAY.</small></div><PinButton pin={pin} /></header>
    <div className="gallery-layout">
      <section className="gallery-room" aria-label="作品展示">
        <div className="gallery-room-heading"><span>THE DAILY COLLECTION</span><button onClick={() => setIndex(dailyArtworkIndex(new Date()))}>今日选画 ↗</button></div>
        <div className="gallery-stage">
          {result.status === "loading" && <div className="gallery-message" role="status"><span aria-hidden="true">▧</span><p>正在布置这幅画…</p></div>}
          {result.status === "error" && <div className="gallery-message" role="status"><p>暂时无法获取作品</p><button onClick={() => setRevision(value => value + 1)}>重新加载</button></div>}
          {data && <ArtworkFrame artwork={data} title={work.title} frame={frame} />}
        </div>
        <p className="gallery-curator-note">{work.note}</p>
        <div className="gallery-browse"><button aria-label="上一幅作品" onClick={previous}>←</button><span>{String(index + 1).padStart(2, "0")} <i>/ {String(GALLERY_WORKS.length).padStart(2, "0")}</i></span><button aria-label="下一幅作品" onClick={next}>→</button></div>
      </section>
      <aside className="gallery-details">
        <span className="gallery-eyebrow">在日常里，看见艺术。</span><h1>{work.title}</h1><p className="gallery-artist">{work.artist}</p>
        {data && <><p className="gallery-original-title" lang="en">{data.title}</p><dl><div><dt>创作年代</dt><dd>{data.objectDate}</dd></div><div><dt>媒材</dt><dd>{data.medium}</dd></div><div><dt>尺寸</dt><dd>{data.dimensions}</dd></div></dl></>}
        <section className="gallery-frame-picker"><h2>为这幅画，选一个框。</h2><div>{FRAME_STYLES.map(style => <button key={style.id} aria-pressed={frame === style.id} onClick={() => setFrame(style.id)}><span className={`gallery-frame-swatch swatch-${style.id}`} aria-hidden="true"><i /></span>{style.label}</button>)}</div></section>
        <p className="gallery-pin-hint">喜欢这一幅？<br />钉到桌面，让艺术陪你一会儿。</p>
        <footer className="gallery-credit"><a href={data ? data.objectURL : "https://www.metmuseum.org/"} target="_blank" rel="noreferrer">The Metropolitan Museum of Art ↗</a><span>开放馆藏 · Open Access / CC0</span></footer>
      </aside>
    </div>
  </main>
  {pin.pinned && <DesktopWidget title="美术馆" className={`gallery-widget widget-frame-${frame}`} width={300} offset={{ right: 330, top: 20 }} onOpen={pin.open} onUnpin={pin.unpin}>
    <div className="gallery-widget-art">{data ? <ArtworkFrame artwork={data} title={work.title} frame={frame} /> : <p role="status">{result.status === "error" ? "暂时无法获取作品" : "正在加载作品…"}</p>}</div>
    <div className="gallery-widget-caption"><div><strong>{work.title}</strong><span>{work.artist}</span></div><button aria-label="下一幅作品" onClick={next}>→</button></div>
    <a className="gallery-widget-credit" href="https://www.metmuseum.org/" target="_blank" rel="noreferrer">The Met · Open Access ↗</a>
  </DesktopWidget>}
  </>;
}
