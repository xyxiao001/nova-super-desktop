"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

type Mode = "调整" | "滤镜" | "裁剪";
type Ratio = "原始" | "自由格式" | "正方形" | "16:9" | "4:5" | "5:7" | "4:3" | "3:2";
type EditState = {
  values: Record<string, number>;
  filter: string;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  ratio: Ratio;
};

const initialValues = { exposure: 0, brilliance: 0, highlights: 0, shadows: 0, brightness: 0, contrast: 0, blackPoint: 0, saturation: 0, vibrance: 0, warmth: 0, tint: 0, mono: 0, definition: 0, noise: 0, sharpness: 0, vignette: 0 };
const initialEdit: EditState = { values: initialValues, filter: "原始状态", rotation: 0, flipX: false, flipY: false, ratio: "原始" };

const sections = [
  { name: "光效", icon: "☀", controls: [["曝光", "exposure"], ["鲜明度", "brilliance"], ["高光", "highlights"], ["阴影", "shadows"], ["亮度", "brightness"], ["对比度", "contrast"], ["黑点", "blackPoint"]] },
  { name: "颜色", icon: "◉", controls: [["饱和度", "saturation"], ["自然饱和度", "vibrance"], ["色温", "warmth"], ["色调", "tint"]] },
  { name: "黑白", icon: "◐", controls: [["强度", "mono"]] },
  { name: "修图", icon: "⌁", controls: [] },
  { name: "消除红眼", icon: "◉", controls: [] },
  { name: "白平衡", icon: "▣", controls: [["色温", "warmth"], ["色调", "tint"]] },
  { name: "曲线", icon: "⌁", controls: [["对比度", "contrast"], ["黑点", "blackPoint"]] },
  { name: "色阶", icon: "▤", controls: [["高光", "highlights"], ["阴影", "shadows"]] },
  { name: "清晰度", icon: "△", controls: [["强度", "definition"]] },
  { name: "可选颜色", icon: "✣", controls: [["饱和度", "saturation"], ["色调", "tint"]] },
  { name: "噪点消除", icon: "▧", controls: [["强度", "noise"]] },
  { name: "锐化", icon: "◢", controls: [["强度", "sharpness"]] },
  { name: "晕影", icon: "◎", controls: [["强度", "vignette"]] },
] as const;

const filters = [
  ["原始状态", "none"], ["鲜明", "saturate(1.35) contrast(1.08)"], ["鲜暖色", "saturate(1.3) sepia(.14) brightness(1.04)"],
  ["鲜冷色", "saturate(1.25) hue-rotate(12deg)"], ["反差色", "contrast(1.28) saturate(1.12)"], ["反差暖色", "contrast(1.24) sepia(.18)"],
  ["反差冷色", "contrast(1.25) hue-rotate(15deg)"], ["单色", "grayscale(1) contrast(1.08)"], ["银色调", "grayscale(1) contrast(1.28) brightness(1.05)"], ["黑白", "grayscale(1) contrast(1.45)"],
] as const;

const ratioValue: Record<Ratio, number | null> = { 原始: null, 自由格式: null, 正方形: 1, "16:9": 16 / 9, "4:5": 4 / 5, "5:7": 5 / 7, "4:3": 4 / 3, "3:2": 3 / 2 };

function imageFilter(edit: EditState) {
  const v = edit.values;
  const brightness = 100 + v.brightness * .55 + v.exposure * .75 + v.shadows * .12;
  const contrast = 100 + v.contrast * .7 + v.definition * .18 + v.sharpness * .12 + v.blackPoint * .16;
  const saturation = Math.max(0, 100 + v.saturation * .8 + v.vibrance * .45 - v.mono);
  const warmth = v.warmth > 0 ? `sepia(${v.warmth * .28}%)` : `hue-rotate(${v.warmth * .16}deg)`;
  const mono = v.mono > 0 ? `grayscale(${v.mono}%)` : "";
  const blur = v.noise > 0 ? `blur(${v.noise * .006}px)` : "";
  const preset = filters.find(([name]) => name === edit.filter)?.[1] ?? "none";
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) ${warmth} hue-rotate(${v.tint * .18}deg) ${mono} ${blur} ${preset}`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("调整");
  const [edit, setEdit] = useState<EditState>(initialEdit);
  const [past, setPast] = useState<EditState[]>([]);
  const [future, setFuture] = useState<EditState[]>([]);
  const [expanded, setExpanded] = useState("光效");
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("未命名照片");
  const [favorite, setFavorite] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const commit = useCallback((next: EditState) => {
    setPast((items) => [...items.slice(-49), edit]);
    setFuture([]);
    setEdit(next);
  }, [edit]);

  const updateValue = (key: string, value: number) => commit({ ...edit, values: { ...edit.values, [key]: value } });
  const undo = () => { const previous = past.at(-1); if (!previous) return; setFuture((items) => [edit, ...items]); setEdit(previous); setPast((items) => items.slice(0, -1)); };
  const redo = () => { const next = future[0]; if (!next) return; setPast((items) => [...items, edit]); setEdit(next); setFuture((items) => items.slice(1)); };

  const draw = useCallback(() => {
    if (!source || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const chosenRatio = ratioValue[edit.ratio] ?? source.width / source.height;
    canvas.width = 1400;
    canvas.height = Math.round(canvas.width / chosenRatio);
    if (canvas.height > 1100) { canvas.height = 1100; canvas.width = Math.round(canvas.height * chosenRatio); }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.filter = imageFilter(edit);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(edit.rotation * Math.PI / 180);
    ctx.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
    const quarter = Math.abs(edit.rotation % 180) === 90;
    const boxW = quarter ? canvas.height : canvas.width;
    const boxH = quarter ? canvas.width : canvas.height;
    const scale = Math.max(boxW / source.width, boxH / source.height);
    const w = source.width * scale;
    const h = source.height * scale;
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
    ctx.restore();
    const vig = edit.values.vignette;
    if (vig > 0) {
      const g = ctx.createRadialGradient(canvas.width/2, canvas.height/2, Math.min(canvas.width,canvas.height)*.2, canvas.width/2, canvas.height/2, Math.max(canvas.width,canvas.height)*.68);
      g.addColorStop(0, "transparent"); g.addColorStop(1, `rgba(0,0,0,${Math.min(.75, vig/130)})`); ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
    }
  }, [edit, source]);

  useEffect(() => draw(), [draw]);

  const loadFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setSource(img); setSourceUrl(url); setFileName(file.name.replace(/\.[^.]+$/, "")); setPast([]); setFuture([]); setEdit(initialEdit); };
    img.src = url;
  };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0]);
  const exportImage = () => canvasRef.current?.toBlob((blob) => { if (!blob) return; const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${fileName}-已编辑.jpg`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }, "image/jpeg", .94);
  const reset = () => commit(initialEdit);
  const autoEnhance = () => commit({ ...edit, values: { ...edit.values, exposure: 6, brilliance: 22, highlights: -10, shadows: 14, contrast: 8, saturation: 7, vibrance: 18, definition: 12 } });

  return (
    <main className="editor-shell" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); }}>
      <input ref={fileRef} className="file-input" type="file" accept="image/*" onChange={onFile} />
      <header className="toolbar">
        <div className="left-tools"><span className="traffic"><i /><i /><i /></span><span className="zoom-control">− <b><i /></b>＋</span></div>
        <nav className="mode-tabs" aria-label="编辑模式">{(["调整", "滤镜", "裁剪"] as Mode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</nav>
        <div className="actions">
          <button aria-label="导入照片" title="导入照片" onClick={() => fileRef.current?.click()}>＋</button>
          <button aria-label="撤销" title="撤销" disabled={!past.length} onClick={undo}>↶</button><button aria-label="重做" title="重做" disabled={!future.length} onClick={redo}>↷</button>
          <button aria-label="收藏" className={favorite ? "selected" : ""} onClick={() => setFavorite(!favorite)}>{favorite ? "♥" : "♡"}</button>
          <button aria-label="旋转" onClick={() => commit({ ...edit, rotation: (edit.rotation + 90) % 360 })}>↻</button>
          <button aria-label="自动增强" className="magic" onClick={autoEnhance}>✦</button>
          <button className="done" disabled={!source} onClick={exportImage}>完成</button>
        </div>
      </header>

      <section className="workspace">
        <div className="canvas-wrap">
          {source ? <div className={`canvas-stage ${mode === "裁剪" ? "cropping" : ""}`}><canvas ref={canvasRef} aria-label="照片编辑画布" />{mode === "裁剪" && <div className="crop-grid"><i /><i /><i /><i /></div>}</div> : <button className="drop-zone" onClick={() => fileRef.current?.click()}><span className="mountain">◇</span><strong>打开一张照片</strong><small>点击选择，或将图片拖到这里</small></button>}
          {source && <div className="image-caption"><span>{fileName}</span><small>{source.width} × {source.height}</small></div>}
        </div>

        <aside className="inspector">
          {mode === "调整" && <AdjustPanel edit={edit} expanded={expanded} setExpanded={setExpanded} updateValue={updateValue} reset={reset} changed={JSON.stringify(edit) !== JSON.stringify(initialEdit)} />}
          {mode === "滤镜" && <FilterPanel sourceUrl={sourceUrl} selected={edit.filter} select={(filter) => commit({ ...edit, filter })} />}
          {mode === "裁剪" && <CropPanel edit={edit} commit={commit} reset={reset} />}
        </aside>
      </section>
    </main>
  );
}

function PanelTitle({ children }: { children: string }) { return <><h2>{children}</h2><div className="divider" /></>; }

function AdjustPanel({ edit, expanded, setExpanded, updateValue, reset, changed }: { edit: EditState; expanded: string; setExpanded: (s: string) => void; updateValue: (k: string, v: number) => void; reset: () => void; changed: boolean }) {
  return <div className="panel-content"><PanelTitle>调整</PanelTitle>{sections.map((section) => {
    const open = expanded === section.name; const active = section.controls.some(([, key]) => edit.values[key] !== 0);
    return <div className={`adjust-section ${open ? "open" : ""}`} key={section.name}>
      <button className="adjust-heading" onClick={() => setExpanded(open ? "" : section.name)}><span className="chevron">⌄</span><span className="adjust-icon">{section.icon}</span><strong>{section.name}</strong>{active && <span className="active-dot" />} {section.controls.length > 0 && <em>自动</em>}</button>
      {open && <div className="slider-group">{section.controls.length ? section.controls.map(([label, key]) => <label className="slider-row" key={key}><span>{label}</span><output>{edit.values[key] > 0 ? "+" : ""}{edit.values[key]}</output><input type="range" min="-100" max="100" value={edit.values[key]} onChange={(e) => updateValue(key, Number(e.target.value))} /></label>) : <p className="tool-hint">在照片上点击或拖动以使用{section.name}工具</p>}</div>}
    </div>;
  })}<button className="reset" onClick={reset} disabled={!changed}>还原调整</button></div>;
}

function FilterPanel({ sourceUrl, selected, select }: { sourceUrl: string; selected: string; select: (s: string) => void }) {
  return <div className="panel-content"><PanelTitle>滤镜</PanelTitle><div className="filter-list">{filters.map(([name, css]) => <button key={name} className={`filter-card ${selected === name ? "active" : ""}`} onClick={() => select(name)}><span className="filter-thumb" style={sourceUrl ? { backgroundImage: `url(${sourceUrl})`, filter: css } : undefined} /><strong>{name}</strong></button>)}</div></div>;
}

function CropPanel({ edit, commit, reset }: { edit: EditState; commit: (s: EditState) => void; reset: () => void }) {
  return <div className="panel-content crop-panel"><PanelTitle>裁剪</PanelTitle><label className="crop-slider"><span>校正</span><output>{edit.rotation}°</output><input type="range" min="-45" max="45" value={edit.rotation > 45 ? 0 : edit.rotation} onChange={(e) => commit({ ...edit, rotation: Number(e.target.value) })} /></label><button className="flip" onClick={() => commit({ ...edit, flipX: !edit.flipX })}>↔ <span>翻转</span></button><h3>宽高比</h3><div className="ratio-list">{(Object.keys(ratioValue) as Ratio[]).map((ratio) => <button key={ratio} className={edit.ratio === ratio ? "active" : ""} onClick={() => commit({ ...edit, ratio })}><span>{edit.ratio === ratio ? "✓" : ""}</span>{ratio}</button>)}</div><div className="crop-actions"><button onClick={() => commit({ ...edit, ratio: "原始", rotation: 0, flipX: false, flipY: false })}>自动</button><button onClick={reset}>还原</button></div></div>;
}
