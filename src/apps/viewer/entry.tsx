"use client";

import "./viewer.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  useWindowInstance,
  useWindowRuntime,
  useWindowTitle,
} from "../../platform/windows/WindowRuntime";
import { useWorkspaceRuntime } from "../../platform/workspace/WorkspaceRuntime";
import {
  clampPhotoZoom,
  createPhotoLibrary,
  photoZoomFromPinch,
  type PhotoAsset,
} from "./photoLibrary";

type AlbumFilter = "all" | "featured" | "desktop";
type AlbumLayout = "comfortable" | "compact";
type FitMode = "contain" | "cover";

const FILTERS: { id: AlbumFilter; label: string }[] = [
  { id: "all", label: "全部照片" },
  { id: "featured", label: "内置精选" },
  { id: "desktop", label: "桌面照片" },
];

export default function PhotoViewerApp() {
  const {
    visibleItems,
    editImage: edit,
  } = useWorkspaceRuntime();
  const windowInstance = useWindowInstance();
  const { isInstanceActive, retargetInstance } = useWindowRuntime();
  const images = visibleItems.filter((item) => item.type === "image");
  const active = windowInstance.target?.kind === "image"
    ? images.find((item) => item.id === windowInstance.target?.itemId) ?? null
    : null;
  const focused = isInstanceActive(windowInstance.id);
  const photos = useMemo(() => createPhotoLibrary(images), [images]);
  const [filter, setFilter] = useState<AlbumFilter>("all");
  const [layout, setLayout] = useState<AlbumLayout>("comfortable");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<FitMode>("contain");
  const [zoomState, setZoomState] = useState({ photoId: "", zoom: 1 });
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const photoGestureRef = useRef<{ x: number; y: number } | null>(null);
  const photoPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const photoPinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const currentId = active ? `desktop:${active.id}` : selectedId;
  const current = photos.find((photo) => photo.id === currentId) ?? null;
  useWindowTitle("viewer", current?.name ?? "照片", true);
  const currentIndex = current ? photos.findIndex((photo) => photo.id === current.id) : -1;
  const zoom = current && zoomState.photoId === current.id ? zoomState.zoom : 1;
  const visiblePhotos = photos.filter((photo) => (
    filter === "all" || photo.source === filter
  ));

  const selectPhoto = useCallback((photo: PhotoAsset) => {
    if (photo.desktopItem) {
      const targetInstance = retargetInstance(windowInstance.id, {
        kind: "image",
        itemId: photo.desktopItem.id,
      });
      if (targetInstance !== windowInstance.id) return;
      setSelectedId(null);
    } else {
      retargetInstance(windowInstance.id);
      setSelectedId(photo.id);
    }
    setZoomState({ photoId: photo.id, zoom: 1 });
  }, [retargetInstance, windowInstance.id]);
  const closePhoto = useCallback(() => {
    retargetInstance(windowInstance.id);
    setSelectedId(null);
  }, [retargetInstance, windowInstance.id]);
  const changeZoom = useCallback((next: number) => {
    if (!currentId) return;
    setZoomState({ photoId: currentId, zoom: clampPhotoZoom(next) });
  }, [currentId]);
  const stepPhoto = useCallback((offset: number) => {
    if (!photos.length) return;
    const index = currentIndex < 0 ? 0 : (currentIndex + offset + photos.length) % photos.length;
    selectPhoto(photos[index]);
  }, [currentIndex, photos, selectPhoto]);
  const beginPhotoGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    photoPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...photoPointersRef.current.values()];
    if (points.length === 2) {
      photoGestureRef.current = null;
      photoPinchRef.current = {
        distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        zoom,
      };
    } else if (points.length === 1 && zoom === 1) {
      photoGestureRef.current = { x: event.clientX, y: event.clientY };
    }
  };
  const updatePhotoGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (!photoPointersRef.current.has(event.pointerId)) return;
    photoPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...photoPointersRef.current.values()];
    const pinch = photoPinchRef.current;
    if (!pinch || points.length < 2 || pinch.distance === 0) return;
    event.preventDefault();
    const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    if (currentId) setZoomState({ photoId: currentId, zoom: photoZoomFromPinch(pinch.zoom, pinch.distance, distance) });
  };
  const finishPhotoGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const pinching = photoPinchRef.current !== null;
    photoPointersRef.current.delete(event.pointerId);
    if (photoPointersRef.current.size < 2) photoPinchRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const origin = photoGestureRef.current;
    photoGestureRef.current = null;
    if (pinching || !origin) return;
    const deltaX = event.clientX - origin.x;
    const deltaY = event.clientY - origin.y;
    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;
    stepPhoto(deltaX < 0 ? 1 : -1);
  };
  const cancelPhotoGesture = (event: ReactPointerEvent<HTMLElement>) => {
    photoPointersRef.current.delete(event.pointerId);
    photoGestureRef.current = null;
    photoPinchRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  useEffect(() => {
    if (!focused || !currentId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("button,input,textarea,[contenteditable=true]")) return;
      if (event.key === "Escape") closePhoto();
      else if (event.key === "ArrowLeft") stepPhoto(-1);
      else if (event.key === "ArrowRight") stepPhoto(1);
      else if (event.key === "+" || event.key === "=") changeZoom(zoom + 0.25);
      else if (event.key === "-") changeZoom(zoom - 0.25);
      else if (event.key === "0") changeZoom(1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeZoom, closePhoto, currentId, focused, stepPhoto, zoom]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!focused || !currentId || !canvas) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [changeZoom, currentId, focused, zoom]);

  if (!current) {
    return <div className="photo-viewer photo-album">
      <aside className="photo-album-sidebar">
        <header><i aria-hidden="true">▧</i><div><strong>照片</strong><span>{photos.length} 张照片</span></div></header>
        <nav aria-label="相册分类">{FILTERS.map((item) => {
          const count = item.id === "all" ? photos.length : photos.filter((photo) => photo.source === item.id).length;
          return <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}><span>{item.label}</span><output>{count}</output></button>;
        })}</nav>
        <footer><span>原图按需加载</span><small>不会自动保存到桌面或离线缓存</small></footer>
      </aside>
      <section className="photo-album-content">
        <header className="photo-album-toolbar">
          <div><strong>{FILTERS.find((item) => item.id === filter)?.label}</strong><span>{visiblePhotos.length} 个项目</span></div>
          <div className="photo-layout-toggle" role="group" aria-label="照片布局">
            <button className={layout === "comfortable" ? "active" : ""} aria-label="宽松布局" title="宽松布局" onClick={() => setLayout("comfortable")}>▦</button>
            <button className={layout === "compact" ? "active" : ""} aria-label="紧凑布局" title="紧凑布局" onClick={() => setLayout("compact")}>▩</button>
          </div>
        </header>
        {visiblePhotos.length ? <div className={`photo-library ${layout}`}>
          {visiblePhotos.map((photo) => <button key={photo.id} onClick={() => selectPhoto(photo)}>
            <span className="photo-thumbnail"><img src={photo.thumbnail} alt="" loading="lazy"/></span>
            <span className="photo-card-copy"><strong>{photo.name}</strong><small>{photo.source === "featured" ? "内置精选" : "桌面照片"}</small></span>
          </button>)}
        </div> : <div className="photo-library-empty"><span>▧</span><strong>桌面上还没有照片</strong><small>从桌面导入或在照片实验室中保存后会显示在这里。</small></div>}
      </section>
    </div>;
  }

  const size = dimensions[current.id] ?? (
    current.width && current.height ? { width: current.width, height: current.height } : null
  );

  return <div
    className="photo-viewer photo-detail"
  >
    <header className="photo-detail-toolbar">
      <button className="photo-back" aria-label="返回相册" title="返回相册" onClick={closePhoto}>‹</button>
      <div className="photo-detail-title"><strong>{current.name}</strong><span>{currentIndex + 1} / {photos.length}</span></div>
      <div className="photo-fit-toggle" role="group" aria-label="图片适配方式">
        <button className={fitMode === "contain" ? "active" : ""} onClick={() => setFitMode("contain")}>适应</button>
        <button className={fitMode === "cover" ? "active" : ""} onClick={() => setFitMode("cover")}>填充</button>
      </div>
      <div className="photo-zoom-controls">
        <button aria-label="缩小" title="缩小" disabled={zoom <= 0.25} onClick={() => changeZoom(zoom - 0.25)}>−</button>
        <input aria-label="图片缩放" type="range" min="0.25" max="4" step="0.25" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))}/>
        <output>{Math.round(zoom * 100)}%</output>
        <button aria-label="放大" title="放大" disabled={zoom >= 4} onClick={() => changeZoom(zoom + 0.25)}>＋</button>
        <button aria-label="重置为100%" title="重置为100%" onClick={() => changeZoom(1)}>100%</button>
      </div>
    </header>
    <section className="photo-stage" onPointerDown={beginPhotoGesture} onPointerMove={updatePhotoGesture} onPointerUp={finishPhotoGesture} onPointerCancel={cancelPhotoGesture}>
      <button className="photo-step previous" aria-label="上一张" title="上一张" onClick={() => stepPhoto(-1)}>‹</button>
      <div ref={canvasRef} className="photo-canvas">
        <img
          src={current.src}
          alt={current.name}
          draggable={false}
          style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, objectFit: fitMode }}
          onDoubleClick={() => changeZoom(zoom === 1 ? 2 : 1)}
          onLoad={(event) => {
            const image = event.currentTarget;
            setDimensions((value) => value[current.id] ? value : {
              ...value,
              [current.id]: { width: image.naturalWidth, height: image.naturalHeight },
            });
          }}
        />
      </div>
      <button className="photo-step next" aria-label="下一张" title="下一张" onClick={() => stepPhoto(1)}>›</button>
    </section>
    <div className="photo-filmstrip" aria-label="照片缩略图">
      {photos.map((photo) => <button key={photo.id} className={photo.id === current.id ? "active" : ""} aria-label={`查看${photo.name}`} onClick={() => selectPhoto(photo)}><img src={photo.thumbnail} alt=""/></button>)}
    </div>
    <footer className="photo-detail-footer">
      <div><strong>{current.name}</strong><span>{current.source === "featured" ? "内置相册 · 未保存到设备" : "桌面照片 · 仅当前设备"}{size ? ` · ${size.width} × ${size.height}` : ""}</span></div>
      {current.desktopItem && <button onClick={() => edit(current.desktopItem!)}><span aria-hidden="true">✦</span><b>在照片实验室中编辑</b></button>}
    </footer>
  </div>;
}
