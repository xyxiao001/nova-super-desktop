"use client";

import type { DesktopItem } from "./desktopFiles";

export default function PhotoViewerApp({ images, active, open, edit }: {
  images: DesktopItem[];
  active: DesktopItem | null;
  open: (item: DesktopItem) => void;
  edit: (item: DesktopItem) => void;
}) {
  return <div className="photo-viewer">
    {active ? <>
      <img src={active.content} alt={active.name}/>
      <footer><strong>{active.name}</strong><span>存储在桌面</span><button onClick={() => edit(active)}>✦ 在照片实验室中编辑</button></footer>
    </> : images.length ? <div className="photo-library">{images.map((image) => <button key={image.id} onDoubleClick={() => open(image)} onClick={() => open(image)}><img src={image.content} alt={image.name}/><span>{image.name}</span></button>)}</div> : <div className="app-empty"><span>✿</span><strong>桌面上还没有照片</strong><small>在照片实验室中完成编辑后，图片会出现在这里。</small></div>}
  </div>;
}
