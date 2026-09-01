"use client";

import "./photo.css";

import { ChangeEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useWindowRuntime } from "../../platform/windows/WindowRuntime";
import {
  useWorkspaceRuntime,
  type WorkspacePhotoSource,
} from "../../platform/workspace/WorkspaceRuntime";

type Mode = "调整" | "滤镜" | "裁剪";
type Ratio = "原始" | "自由格式" | "正方形" | "16:9" | "4:5" | "5:7" | "4:3" | "3:5" | "3:2";
type CropRect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };
type EditState = { values: Record<string, number>; filter: string; rotation: number; flipX: boolean; flipY: boolean; ratio: Ratio; crop: CropRect; redEyes: Point[] };
type Control = { label: string; key: string; min?: number; max?: number };

const defaults: Record<string, number> = {
  overallLight: 0, brilliance: 0, exposure: 0, highlights: 0, shadows: 0, brightness: 0, contrast: 0, blackPoint: 0,
  overallColor: 0, saturation: 0, vibrance: 0, colorCast: 0,
  overallBW: 0, bwIntensity: 50, bwNeutral: 0, bwTone: 0, bwGrain: 0,
  temperature: 0, curve: 0, levelBlack: 0, levelMid: 0, levelWhite: 0, definition: 0,
  selectiveHue: 0, selectiveSat: 0, selectiveLum: 0, selectiveRange: 50, noise: 0, sharpness: 0, vignette: 0,
  vertical: 0, horizontal: 0,
};
const initialEdit: EditState = { values: defaults, filter: "原始状态", rotation: 0, flipX: false, flipY: false, ratio: "原始", crop: { x: 0, y: 0, w: 1, h: 1 }, redEyes: [] };

const primary = [
  { name: "光效", icon: "☀", main: "overallLight", controls: ["鲜明度:brilliance", "曝光:exposure", "高光:highlights", "阴影:shadows", "亮度:brightness", "对比度:contrast", "黑点:blackPoint"] },
  { name: "颜色", icon: "◉", main: "overallColor", controls: ["饱和度:saturation", "自然饱和度:vibrance", "色偏:colorCast"] },
  { name: "黑白", icon: "◐", main: "overallBW", controls: ["强度:bwIntensity", "中性:bwNeutral", "色调:bwTone", "颗粒:bwGrain"] },
].map((group) => ({ ...group, controls: group.controls.map((value) => { const [label, key] = value.split(":"); return { label, key }; }) }));

const advanced: { name: string; icon: string; controls: Control[]; visual?: string }[] = [
  { name: "消除红眼", icon: "◉", controls: [] },
  { name: "白平衡", icon: "▣", controls: [{ label: "色温", key: "temperature" }] },
  { name: "曲线", icon: "⌁", controls: [{ label: "曲线", key: "curve" }], visual: "curve" },
  { name: "色阶", icon: "▤", controls: [{ label: "黑场", key: "levelBlack" }, { label: "中间调", key: "levelMid" }, { label: "白场", key: "levelWhite" }], visual: "levels" },
  { name: "清晰度", icon: "△", controls: [{ label: "数量", key: "definition", min: 0 }] },
  { name: "可选颜色", icon: "✣", controls: [{ label: "色调", key: "selectiveHue" }, { label: "饱和度", key: "selectiveSat" }, { label: "亮度", key: "selectiveLum" }, { label: "范围", key: "selectiveRange", min: 0 }] },
  { name: "噪点消除", icon: "▧", controls: [{ label: "数量", key: "noise", min: 0 }] },
  { name: "锐化", icon: "◢", controls: [{ label: "强度", key: "sharpness", min: 0 }] },
  { name: "晕影", icon: "◎", controls: [{ label: "强度", key: "vignette", min: 0 }] },
];

const filters = [
  ["原始状态", "none"], ["鲜明", "saturate(1.35) contrast(1.08)"], ["鲜暖色", "saturate(1.3) sepia(.14) brightness(1.04)"],
  ["鲜冷色", "saturate(1.25) hue-rotate(12deg)"], ["反差色", "contrast(1.28) saturate(1.12)"], ["反差暖色", "contrast(1.24) sepia(.18)"],
  ["反差冷色", "contrast(1.25) hue-rotate(15deg)"], ["单色", "grayscale(1) contrast(1.08)"], ["银色调", "grayscale(1) contrast(1.28) brightness(1.05)"], ["黑白", "grayscale(1) contrast(1.45)"],
] as const;
const ratioValue: Record<Ratio, number | null> = { 原始: null, 自由格式: null, 正方形: 1, "16:9": 16/9, "4:5": 4/5, "5:7": 5/7, "4:3": 4/3, "3:5": 3/5, "3:2": 3/2 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function imageFilter(edit: EditState) {
  const v = edit.values;
  const selectiveAmount = v.selectiveRange / 50;
  const bwEnabled = v.overallBW !== 0 || v.bwIntensity !== defaults.bwIntensity || v.bwNeutral !== 0 || v.bwTone !== 0 || v.bwGrain !== 0;
  const brightness = 100 + v.overallLight*.35 + v.brightness*.5 + v.exposure*.7 + v.shadows*.1 - v.highlights*.05 + v.bwNeutral*.18 + v.selectiveLum*.08*selectiveAmount + v.levelMid*.12 + v.levelWhite*.08;
  const contrast = 100 + v.brilliance*.25 + v.contrast*.65 + v.blackPoint*.2 + v.definition*.25 + v.sharpness*.14 + v.curve*.5 + v.levelBlack*.12 - v.levelMid*.08 + v.levelWhite*.1 + v.bwTone*.28;
  const saturation = Math.max(0, 100 + v.overallColor*.55 + v.saturation*.75 + v.vibrance*.48 + v.selectiveSat*.15*selectiveAmount);
  const bw = bwEnabled ? clamp(Math.abs(v.overallBW) + v.bwIntensity, 0, 100) : 0;
  const preset = filters.find(([name]) => name === edit.filter)?.[1] ?? "none";
  const presetFilter = preset === "none" ? "" : preset;
  const warmth = v.temperature > 0 ? `sepia(${v.temperature*.32}%)` : `hue-rotate(${v.temperature*.16}deg)`;
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${bw}%) ${warmth} hue-rotate(${(v.colorCast+v.selectiveHue*selectiveAmount)*.16}deg) blur(${v.noise*.004}px) ${presetFilter}`;
}


export default function PhotoEditorApp() {
  const { photoEditorSource, savePhotoEdit } = useWorkspaceRuntime();
  const active = useWindowRuntime().isAppActive("photo");
  return <PhotoEditorWorkspace key={photoEditorSource?.id??"default-photo"} active={active} initialImage={photoEditorSource} onSave={savePhotoEdit}/>;
}

function PhotoEditorWorkspace({active,initialImage,onSave}:{active:boolean;initialImage:WorkspacePhotoSource|null;onSave:(mode:"copy"|"replace",name:string,content:string)=>void}) {
  const [mode, setMode] = useState<Mode>("调整");
  const [edit, setEdit] = useState<EditState>(initialEdit);
  const [past, setPast] = useState<EditState[]>([]), [future, setFuture] = useState<EditState[]>([]);
  const [openGroups, setOpenGroups] = useState(["光效", "颜色", "黑白"]);
  const [openOptions, setOpenOptions] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [replaceSourceId, setReplaceSourceId] = useState(initialImage?.id??null);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [source, setSource] = useState<HTMLImageElement | null>(null), [sourceUrl, setSourceUrl] = useState(initialImage?.content??"/default-photo.jpg"), [fileName, setFileName] = useState(initialImage?.name??"海岸风光");
  const [favorite, setFavorite] = useState(false), [zoom, setZoom] = useState(1), [pan, setPan] = useState({ x: 0, y: 0 }), [fit, setFit] = useState({ w: 900, h: 600 });
  const canvasRef = useRef<HTMLCanvasElement>(null), viewportRef = useRef<HTMLDivElement>(null), stageRef = useRef<HTMLDivElement>(null), fileRef = useRef<HTMLInputElement>(null);
  const cropDrag = useRef<{ startX:number; startY:number; crop:CropRect; handle:string } | null>(null);
  const panDrag = useRef<{ startX:number; startY:number; pan:{x:number;y:number} } | null>(null);

  const commit = useCallback((next: EditState) => { setPast((items) => [...items.slice(-59), edit]); setFuture([]); setEdit(next); }, [edit]);
  const setValue = (key: string, value: number) => commit({ ...edit, values: { ...edit.values, [key]: value } });
  const undo = () => { const previous=past.at(-1); if(!previous)return; setFuture((items)=>[edit,...items]);setEdit(previous);setPast((items)=>items.slice(0,-1)); };
  const redo = () => { const next=future[0];if(!next)return;setPast((items)=>[...items,edit]);setEdit(next);setFuture((items)=>items.slice(1)); };

  useEffect(() => { const img=new Image();img.onload=()=>setSource(img);img.src=initialImage?.content??"/default-photo.jpg"; }, [initialImage]);
  useEffect(() => {
    const viewport=viewportRef.current;if(!viewport||!source)return;
    const update=()=>{const rect=viewport.getBoundingClientRect(), maxW=Math.max(120,rect.width-82), maxH=Math.max(120,rect.height-82), ratio=(Math.abs(edit.rotation%180)===90?source.height/source.width:source.width/source.height);let w=maxW,h=w/ratio;if(h>maxH){h=maxH;w=h*ratio}setFit({w,h});};
    update();const observer=new ResizeObserver(update);observer.observe(viewport);return()=>observer.disconnect();
  },[source,edit.rotation]);

  useEffect(()=>{const viewport=viewportRef.current;if(!viewport)return;const stop=(event:Event)=>{event.preventDefault();event.stopPropagation()};const wheel=(event:globalThis.WheelEvent)=>{stop(event);setZoom((current)=>{const next=clamp(current*Math.exp(-event.deltaY*(event.ctrlKey ? .008 : .0025)),1,5);if(next===1)setPan({x:0,y:0});return next})};viewport.addEventListener("wheel",wheel,{passive:false});viewport.addEventListener("gesturestart",stop,{passive:false});viewport.addEventListener("gesturechange",stop,{passive:false});return()=>{viewport.removeEventListener("wheel",wheel);viewport.removeEventListener("gesturestart",stop);viewport.removeEventListener("gesturechange",stop)}},[]);

  const draw=useCallback(()=>{if(!source||!canvasRef.current)return;const canvas=canvasRef.current,ctx=canvas.getContext("2d");if(!ctx)return;const quarter=Math.abs(edit.rotation%180)===90,ratio=quarter?source.height/source.width:source.width/source.height;canvas.width=1600;canvas.height=Math.round(1600/ratio);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.filter=imageFilter(edit);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(edit.rotation*Math.PI/180);ctx.scale(edit.flipX?-1:1,edit.flipY?-1:1);ctx.transform(1,edit.values.vertical/500,edit.values.horizontal/500,1,0,0);const boxW=quarter?canvas.height:canvas.width,boxH=quarter?canvas.width:canvas.height,scale=Math.max(boxW/source.width,boxH/source.height),w=source.width*scale,h=source.height*scale;ctx.drawImage(source,-w/2,-h/2,w,h);ctx.restore();for(const point of edit.redEyes){const x=point.x*canvas.width,y=point.y*canvas.height,r=Math.min(canvas.width,canvas.height)*.022,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,"rgba(12,8,6,.9)");g.addColorStop(.45,"rgba(35,22,16,.72)");g.addColorStop(1,"rgba(35,22,16,0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}if(edit.values.vignette>0){const g=ctx.createRadialGradient(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*.25,canvas.width/2,canvas.height/2,Math.max(canvas.width,canvas.height)*.7);g.addColorStop(0,"transparent");g.addColorStop(1,`rgba(0,0,0,${Math.min(.78,edit.values.vignette/130)})`);ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height)}if(edit.values.bwGrain>0){ctx.globalAlpha=edit.values.bwGrain/900;for(let i=0;i<2500;i++){const n=(i*9301+49297)%233280;ctx.fillStyle=i%2?"#fff":"#000";ctx.fillRect((n%canvas.width),((n*17)%canvas.height),2,2)}ctx.globalAlpha=1}},[source,edit]);
  useEffect(()=>draw(),[draw]);

  const loadFile=(file?:File)=>{if(!file||!file.type.startsWith("image/"))return;if(sourceUrl.startsWith("blob:"))URL.revokeObjectURL(sourceUrl);const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{setSource(img);setSourceUrl(url);setFileName(file.name.replace(/\.[^.]+$/,"")||"照片");setReplaceSourceId(null);setReplaceConfirm(false);setEdit(initialEdit);setPast([]);setFuture([]);setZoom(1);setPan({x:0,y:0})};img.src=url};
  const onFile=(event:ChangeEvent<HTMLInputElement>)=>loadFile(event.target.files?.[0]);
  const setZoomLevel=(value:number)=>{const next=clamp(value,1,5);setZoom(next);if(next===1)setPan({x:0,y:0})};
  const updateZoomFromPointer=(event:ReactPointerEvent<HTMLLabelElement>)=>{const rect=event.currentTarget.getBoundingClientRect();setZoomLevel(1+clamp((event.clientX-rect.left)/rect.width,0,1)*4)};
  const startPan=(event:ReactPointerEvent)=>{if(mode==="裁剪"||zoom<=1)return;panDrag.current={startX:event.clientX,startY:event.clientY,pan};stageRef.current?.setPointerCapture(event.pointerId)};
  const movePan=(event:ReactPointerEvent)=>{const drag=panDrag.current;if(!drag)return;setPan({x:drag.pan.x+event.clientX-drag.startX,y:drag.pan.y+event.clientY-drag.startY})};
  const endPan=(event:ReactPointerEvent)=>{if(!panDrag.current)return;panDrag.current=null;stageRef.current?.releasePointerCapture(event.pointerId)};
  const startCanvas=(event:ReactPointerEvent)=>{if(activeTool==="消除红眼"&&mode==="调整"&&stageRef.current){event.preventDefault();const rect=stageRef.current.getBoundingClientRect(),point={x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};commit({...edit,redEyes:[...edit.redEyes,point]});return}startPan(event)};

  const applyRatio=(ratio:Ratio)=>{if(!canvasRef.current||ratio==="自由格式"){commit({...edit,ratio});return}if(ratio==="原始"){commit({...edit,ratio,crop:{x:0,y:0,w:1,h:1}});return}const canvasRatio=canvasRef.current.width/canvasRef.current.height,target=ratioValue[ratio]??canvasRatio;let w=1,h=1;if(target>canvasRatio)h=canvasRatio/target;else w=target/canvasRatio;commit({...edit,ratio,crop:{x:(1-w)/2,y:(1-h)/2,w,h}})};
  const startCrop=(event:ReactPointerEvent,handle:string)=>{event.preventDefault();event.stopPropagation();cropDrag.current={startX:event.clientX,startY:event.clientY,crop:edit.crop,handle};setPast((items)=>[...items.slice(-59),edit]);setFuture([]);stageRef.current?.setPointerCapture(event.pointerId)};
  const moveCrop=(event:ReactPointerEvent)=>{const drag=cropDrag.current,stage=stageRef.current;if(!drag||!stage)return;const bounds=stage.getBoundingClientRect(),dx=(event.clientX-drag.startX)/bounds.width,dy=(event.clientY-drag.startY)/bounds.height;let{x,y,w,h}=drag.crop;const min=.06;if(drag.handle==="move"){x=clamp(x+dx,0,1-w);y=clamp(y+dy,0,1-h)}else{const right=x+w,bottom=y+h;if(drag.handle.includes("w")){x=clamp(x+dx,0,right-min);w=right-x}if(drag.handle.includes("e"))w=clamp(w+dx,min,1-x);if(drag.handle.includes("n")){y=clamp(y+dy,0,bottom-min);h=bottom-y}if(drag.handle.includes("s"))h=clamp(h+dy,min,1-y);const target=ratioValue[edit.ratio];if(target){const normalized=target/(canvasRef.current!.width/canvasRef.current!.height),anchorRight=drag.handle.includes("w"),anchorBottom=drag.handle.includes("n");if(w/h>normalized)h=w/normalized;else w=h*normalized;if(w>1-(anchorRight?0:x)){w=1-(anchorRight?0:x);h=w/normalized}if(h>1-(anchorBottom?0:y)){h=1-(anchorBottom?0:y);w=h*normalized}x=anchorRight?right-w:x;y=anchorBottom?bottom-h:y;x=clamp(x,0,1-w);y=clamp(y,0,1-h)}}setEdit((current)=>({...current,crop:{x,y,w,h}}))};
  const endCrop=(event:ReactPointerEvent)=>{if(!cropDrag.current)return;cropDrag.current=null;stageRef.current?.releasePointerCapture(event.pointerId)};

  const exportImage=(saveMode:"copy"|"replace")=>{const canvas=canvasRef.current;if(!canvas)return;const{x,y,w,h}=edit.crop,sx=Math.round(x*canvas.width),sy=Math.round(y*canvas.height),sw=Math.max(1,Math.round(w*canvas.width)),sh=Math.max(1,Math.round(h*canvas.height)),output=document.createElement("canvas");output.width=sw;output.height=sh;output.getContext("2d")?.drawImage(canvas,sx,sy,sw,sh,0,0,sw,sh);onSave(saveMode,`${fileName}-已编辑.jpg`,output.toDataURL("image/jpeg",.9));if(saveMode==="replace"){setEdit(initialEdit);setPast([]);setFuture([]);setZoom(1);setPan({x:0,y:0})}setReplaceConfirm(false)};
  useEffect(()=>{if(!active)return;const shortcut=(event:KeyboardEvent)=>{if(!(event.ctrlKey||event.metaKey))return;const key=event.key.toLowerCase();if(key==="s"){event.preventDefault();if(replaceSourceId)setReplaceConfirm(true);else exportImage("copy")}else if(key==="z"){event.preventDefault();event.shiftKey?redo():undo()}else if(key==="y"){event.preventDefault();redo()}else if(key==="0"){event.preventDefault();setZoomLevel(1)}else if(key==="="||key==="+"){event.preventDefault();setZoomLevel(zoom+.25)}else if(key==="-"){event.preventDefault();setZoomLevel(zoom-.25)}};window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut)},[active,edit,fileName,future,past,replaceSourceId,source,zoom]);
  const switchMode=(next:Mode)=>{setMode(next);if(next==="裁剪"){setZoomLevel(1);setPan({x:0,y:0})}};
  const clearImage=()=>{if(sourceUrl.startsWith("blob:"))URL.revokeObjectURL(sourceUrl);setSource(null);setSourceUrl("");setFileName("");setReplaceSourceId(null);setReplaceConfirm(false);setEdit(initialEdit);setPast([]);setFuture([]);setZoom(1);setPan({x:0,y:0});setMode("调整");setActiveTool(null)};

  return <main className="editor-shell" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();loadFile(e.dataTransfer.files[0])}}>
    <input ref={fileRef} className="file-input" type="file" accept="image/*" onChange={onFile}/>
    <header className="toolbar">
      <div className="left-tools"><button className="clear-photo" aria-label="清空图片" title="清空图片" disabled={!source} onClick={clearImage}>×</button>{source&&mode!=="裁剪"&&<div className="zoom-control"><button aria-label="缩小" title="缩小" onClick={()=>setZoomLevel(zoom-.25)}>−</button><label className="zoom-track" onPointerDown={(e)=>{e.currentTarget.setPointerCapture(e.pointerId);updateZoomFromPointer(e)}} onPointerMove={(e)=>{if(e.buttons)updateZoomFromPointer(e)}}><input aria-label="缩放" type="range" min="1" max="5" step=".01" value={zoom} onChange={(e)=>setZoomLevel(Number(e.target.value))}/></label><button aria-label="放大" title="放大" onClick={()=>setZoomLevel(zoom+.25)}>＋</button></div>}</div>
      <nav className="mode-tabs">{(["调整","滤镜","裁剪"] as Mode[]).map((item)=><button key={item} className={mode===item?"active":""} onClick={()=>switchMode(item)}>{item}</button>)}</nav>
      <div className="actions"><button aria-label="导入照片" title="导入照片" onClick={()=>fileRef.current?.click()}>＋</button><button aria-label="撤销编辑" title="撤销" disabled={!past.length} onClick={undo}>↶</button><button aria-label="重做编辑" title="重做" disabled={!future.length} onClick={redo}>↷</button><button aria-label={favorite?"取消收藏":"收藏"} title={favorite?"取消收藏":"收藏"} className={favorite?"selected":""} onClick={()=>setFavorite(!favorite)}>{favorite?"♥":"♡"}</button><button aria-label="旋转照片" title="旋转" onClick={()=>commit({...edit,rotation:(edit.rotation+90)%360})}>↻</button><button aria-label="自动增强" title="自动增强" className="magic" onClick={()=>commit({...edit,values:{...edit.values,brilliance:24,exposure:7,highlights:-12,shadows:17,contrast:8,vibrance:18,definition:14}})}>✦</button>{replaceSourceId&&<button className="save-copy" title="另存为桌面副本" onClick={()=>exportImage("copy")}>另存</button>}<button className="done" title={replaceSourceId?"覆盖原图":"存储到桌面"} onClick={()=>replaceSourceId?setReplaceConfirm(true):exportImage("copy")}>{replaceSourceId?"保存":"完成"}</button></div>
    </header>
    <section className="workspace">
      <div ref={viewportRef} className="canvas-viewport" onDoubleClick={()=>source&&setZoomLevel(zoom===1?2:1)}>
        {source?<><div ref={stageRef} className={`canvas-stage ${mode==="裁剪"?"cropping":""} ${zoom>1?"zoomed":""} ${activeTool==="消除红眼"?"red-eye-active":""}`} style={{width:fit.w,height:fit.h,transform:`translate3d(${pan.x}px,${pan.y}px,0) scale(${zoom})`}} onPointerDown={startCanvas} onPointerMove={(e)=>{movePan(e);moveCrop(e)}} onPointerUp={(e)=>{endPan(e);endCrop(e)}} onPointerCancel={(e)=>{endPan(e);endCrop(e)}}>
          <canvas ref={canvasRef} aria-label="照片编辑画布"/>{mode==="裁剪"&&<CropOverlay crop={edit.crop} start={startCrop}/>}
        </div>{zoom>1&&mode!=="裁剪"&&<span className="zoom-badge">{Math.round(zoom*100)}%</span>}<div className="image-caption"><span>{fileName}</span><small>{source.width} × {source.height}</small></div></>:<button className="empty-state" onClick={()=>fileRef.current?.click()}><span>＋</span><strong>打开一张照片</strong><small>点击选择，或将图片拖到这里</small></button>}
      </div>
      <aside className="inspector">
        {!source?<div className="empty-inspector">打开照片后显示编辑工具</div>:<>{mode==="调整"&&<AdjustPanel edit={edit} sourceUrl={sourceUrl} openGroups={openGroups} openOptions={openOptions} activeTool={activeTool} toggleGroup={(name)=>{setOpenGroups((items)=>items.includes(name)?items.filter((i)=>i!==name):[...items,name]);if(name==="消除红眼")setActiveTool((current)=>current==="消除红眼"?null:"消除红眼")}} toggleOptions={(name)=>setOpenOptions((items)=>items.includes(name)?items.filter((i)=>i!==name):[...items,name])} setValue={setValue} commit={commit}/>}
        {mode==="滤镜"&&<FilterPanel sourceUrl={sourceUrl} selected={edit.filter} select={(filter)=>commit({...edit,filter})}/>} {mode==="裁剪"&&<CropPanel edit={edit} commit={commit} applyRatio={applyRatio}/>}</>}
      </aside>
    </section>
    {replaceConfirm&&<div className="photo-save-layer"><section role="dialog" aria-modal="true" aria-label="确认覆盖原图"><strong>覆盖原图？</strong><p>编辑结果将替换桌面中的原图片。</p><div><button onClick={()=>setReplaceConfirm(false)}>取消</button><button className="confirm" onClick={()=>exportImage("replace")}>覆盖原图</button></div></section></div>}
  </main>;
}

function CropOverlay({crop,start}:{crop:CropRect;start:(e:ReactPointerEvent,h:string)=>void}){return <div className="crop-box" style={{left:`${crop.x*100}%`,top:`${crop.y*100}%`,width:`${crop.w*100}%`,height:`${crop.h*100}%`}} onPointerDown={(e)=>start(e,"move")}><span className="crop-lines"/>{["nw","n","ne","e","se","s","sw","w"].map((h)=><i key={h} className={`handle ${h}`} onPointerDown={(e)=>start(e,h)}/>)}</div>}
function PanelTitle({children}:{children:string}){return <><h2>{children}</h2><div className="divider"/></>}

function AdjustPanel({edit,sourceUrl,openGroups,openOptions,activeTool,toggleGroup,toggleOptions,setValue,commit}:{edit:EditState;sourceUrl:string;openGroups:string[];openOptions:string[];activeTool:string|null;toggleGroup:(n:string)=>void;toggleOptions:(n:string)=>void;setValue:(k:string,v:number)=>void;commit:(e:EditState)=>void}){
  const resetKeys=(keys:string[])=>commit({...edit,values:{...edit.values,...Object.fromEntries(keys.map((key)=>[key,defaults[key]]))}});
  const primaryAuto:Record<string,Record<string,number>>={光效:{overallLight:22,brilliance:20,exposure:6,highlights:-12,shadows:15,brightness:5,contrast:8,blackPoint:4},颜色:{overallColor:22,saturation:8,vibrance:20,colorCast:0},黑白:{overallBW:50,bwIntensity:50,bwNeutral:0,bwTone:8,bwGrain:5}};
  const advancedAuto:Record<string,Record<string,number>>={白平衡:{temperature:8},曲线:{curve:12},色阶:{levelBlack:-8,levelMid:5,levelWhite:8},清晰度:{definition:28},可选颜色:{selectiveHue:8,selectiveSat:14,selectiveLum:5,selectiveRange:50},噪点消除:{noise:24},锐化:{sharpness:28},晕影:{vignette:20}};
  const applyValues=(values:Record<string,number>)=>commit({...edit,values:{...edit.values,...values}});
  return <div className="panel-content adjust-panel"><PanelTitle>调整</PanelTitle>{primary.map((group)=>{const keys=[group.main,...group.controls.map((c)=>c.key)],open=openGroups.includes(group.name),options=openOptions.includes(group.name),active=keys.some((key)=>edit.values[key]!==defaults[key]);return <section className={`photo-adjust ${open?"open":""}`} key={group.name}><div className="adjust-title"><button className="disclosure" onClick={()=>toggleGroup(group.name)}>⌄</button><span className="adjust-icon">{group.icon}</span><strong>{group.name}</strong>{active&&<button className="undo-section" onClick={()=>resetKeys(keys)}>↶</button>}<button className="auto-pill" onClick={()=>active?resetKeys(keys):applyValues(primaryAuto[group.name])}>自动</button><button aria-label={`清除${group.name}调整`} title={active?"清除调整":"尚未调整"} className={`active-ring ${active?"on":""}`} disabled={!active} onClick={()=>resetKeys(keys)}/></div>{open&&<><PreviewSlider sourceUrl={sourceUrl} value={edit.values[group.main]} mode={group.name} onChange={(value)=>setValue(group.main,value)}/><button className={`options-button ${options?"open":""}`} onClick={()=>toggleOptions(group.name)}>› <span>选项</span></button>{options&&<div className="option-sliders">{group.controls.map((control)=><ControlSlider key={control.key} control={control} value={edit.values[control.key]} onChange={setValue}/>)}</div>}</>}</section>})}
  {advanced.map((group)=>{const open=openGroups.includes(group.name),isRedEye=group.name==="消除红眼",active=isRedEye?edit.redEyes.length>0:group.controls.some((c)=>edit.values[c.key]!==defaults[c.key]);const reset=()=>isRedEye?commit({...edit,redEyes:[]}):resetKeys(group.controls.map((c)=>c.key));return <section className={`advanced-adjust ${open?"open":""}`} key={group.name}><div className="adjust-title"><button className="disclosure" onClick={()=>toggleGroup(group.name)}>⌄</button><span className="adjust-icon">{group.icon}</span><strong>{group.name}</strong>{active&&<button className="undo-section" onClick={reset}>↶</button>}{group.controls.length>0&&<button className="auto-pill" onClick={()=>active?reset():applyValues(advancedAuto[group.name])}>自动</button>}<button aria-label={`清除${group.name}调整`} title={active?"清除调整":"尚未调整"} className={`active-ring ${active?"on":""}`} disabled={!active} onClick={reset}/></div>{open&&<div className="advanced-body">{group.visual==="curve"&&<div className="curve-visual"><i/><b style={{transform:`rotate(${-45+edit.values.curve*.18}deg)`}}/></div>}{group.visual==="levels"&&<div className="histogram"><i/><i/><i/><i/><i/></div>}{group.controls.length?group.controls.map((control)=><ControlSlider key={control.key} control={control} value={edit.values[control.key]} onChange={setValue}/>):<p className={`tool-hint ${activeTool==="消除红眼"?"active":""}`}>{activeTool==="消除红眼"?"已启用：在照片上点击红眼区域":"展开后可在照片上点击红眼区域"}</p>}</div>}</section>})}<button className="reset" disabled={JSON.stringify(edit)===JSON.stringify(initialEdit)} onClick={()=>commit(initialEdit)}>还原调整</button></div>}

function PreviewSlider({sourceUrl,value,mode,onChange}:{sourceUrl:string;value:number;mode:string;onChange:(n:number)=>void}){const filter=mode==="光效"?`brightness(${100+value*.5}%) contrast(${100+value*.18}%)`:mode==="颜色"?`saturate(${100+value*.75}%)`:`grayscale(${Math.abs(value)}%) contrast(${100+Math.abs(value)*.2}%)`;const update=(event:ReactPointerEvent<HTMLLabelElement>)=>{const rect=event.currentTarget.getBoundingClientRect();onChange(Math.round(clamp(((event.clientX-rect.left)/rect.width)*200-100,-100,100)))};return <label className="preview-slider" onPointerDown={(e)=>{e.currentTarget.setPointerCapture(e.pointerId);update(e)}} onPointerMove={(e)=>{if(e.buttons)update(e)}}><span style={{backgroundImage:`url(${sourceUrl})`,filter}}/><i style={{left:`${(value+100)/2}%`}}/><input aria-label={`${mode}总强度`} type="range" min="-100" max="100" value={value} onChange={(e)=>onChange(Number(e.target.value))}/></label>}
function ControlSlider({control,value,onChange}:{control:Control;value:number;onChange:(k:string,v:number)=>void}){const min=control.min??-100,max=control.max??100;return <label className="control-slider"><span>{control.label}</span><output>{value>0?"+":""}{value.toFixed(2)}</output><input type="range" min={min} max={max} value={value} onChange={(e)=>onChange(control.key,Number(e.target.value))}/></label>}
function FilterPanel({sourceUrl,selected,select}:{sourceUrl:string;selected:string;select:(s:string)=>void}){return <div className="panel-content"><PanelTitle>滤镜</PanelTitle><div className="filter-list">{filters.map(([name,css])=><button key={name} className={`filter-card ${selected===name?"active":""}`} onClick={()=>select(name)}><span className="filter-thumb" style={{backgroundImage:`url(${sourceUrl})`,filter:css}}/><strong>{name}</strong></button>)}</div></div>}
function CropPanel({edit,commit,applyRatio}:{edit:EditState;commit:(e:EditState)=>void;applyRatio:(r:Ratio)=>void}){return <div className="panel-content crop-panel"><PanelTitle>裁剪</PanelTitle>{[{label:"校正",key:"rotation",value:edit.rotation},{label:"垂直",key:"vertical",value:edit.values.vertical},{label:"水平",key:"horizontal",value:edit.values.horizontal}].map((item)=><label className="crop-control" key={item.key}><span>{item.label}</span><output>{item.value}°</output><input type="range" min="-45" max="45" value={item.value} onChange={(e)=>item.key==="rotation"?commit({...edit,rotation:Number(e.target.value)}):commit({...edit,values:{...edit.values,[item.key]:Number(e.target.value)}})}/></label>)}<button className="flip" onClick={()=>commit({...edit,flipX:!edit.flipX})}>↔ <span>翻转</span></button><h3>宽高比</h3><div className="ratio-list">{(Object.keys(ratioValue) as Ratio[]).map((ratio)=><button key={ratio} className={edit.ratio===ratio?"active":""} onClick={()=>applyRatio(ratio)}><span>{edit.ratio===ratio?"✓":""}</span>{ratio}</button>)}</div><p className="crop-tip">可拖动四角、四边改变大小；拖动选区中心移动位置</p><div className="crop-actions"><button onClick={()=>commit({...edit,ratio:"原始",crop:{x:0,y:0,w:1,h:1},rotation:0,flipX:false,flipY:false,values:{...edit.values,vertical:0,horizontal:0}})}>自动</button><button onClick={()=>commit(initialEdit)}>还原</button></div></div>}
