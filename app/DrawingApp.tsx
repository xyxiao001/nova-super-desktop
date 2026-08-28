"use client";

import "./games-tools.css";

import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

type DrawingTool = "pen" | "eraser";
type DrawingPoint = { x:number; y:number };
type DrawingStroke = { tool:DrawingTool; color:string; width:number; points:DrawingPoint[] };

const COLORS = ["#17191c","#e5484d","#e28b18","#2c9b62","#2778d4","#7656d6"];

function drawStroke(context:CanvasRenderingContext2D,stroke:DrawingStroke,width:number,height:number){
  const points=stroke.points;
  if(!points.length)return;
  context.save();
  context.globalCompositeOperation=stroke.tool==="eraser"?"destination-out":"source-over";
  context.strokeStyle=stroke.color;
  context.fillStyle=stroke.color;
  context.lineWidth=stroke.width;
  context.lineCap="round";
  context.lineJoin="round";
  context.beginPath();
  context.moveTo(points[0].x*width,points[0].y*height);
  for(const point of points.slice(1))context.lineTo(point.x*width,point.y*height);
  if(points.length===1){
    context.arc(points[0].x*width,points[0].y*height,stroke.width/2,0,Math.PI*2);
    context.fill();
  }else context.stroke();
  context.restore();
}

export default function DrawingApp({onSave}:{onSave:(name:string,content:string)=>void}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const activeStroke=useRef<DrawingStroke|null>(null);
  const [tool,setTool]=useState<DrawingTool>("pen");
  const [color,setColor]=useState(COLORS[0]);
  const [brushWidth,setBrushWidth]=useState(6);
  const [history,setHistory]=useState<DrawingStroke[][]>([[]]);
  const [historyIndex,setHistoryIndex]=useState(0);
  const strokes=history[historyIndex];

  const redraw=useCallback(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<1||rect.height<1)return;
    const scale=Math.max(1,window.devicePixelRatio||1),pixelWidth=Math.round(rect.width*scale),pixelHeight=Math.round(rect.height*scale);
    if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight}
    const context=canvas.getContext("2d");
    if(!context)return;
    context.setTransform(1,0,0,1,0,0);
    context.clearRect(0,0,canvas.width,canvas.height);
    context.setTransform(scale,0,0,scale,0,0);
    for(const stroke of strokes)drawStroke(context,stroke,rect.width,rect.height);
  },[strokes]);

  useEffect(()=>{redraw();const canvas=canvasRef.current;if(!canvas)return;const observer=new ResizeObserver(redraw);observer.observe(canvas);return()=>observer.disconnect()},[redraw]);

  const pointFromEvent=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const rect=event.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))}};
  const startDrawing=(event:ReactPointerEvent<HTMLCanvasElement>)=>{if(event.button!==0||activeStroke.current)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const stroke:DrawingStroke={tool,color,width:brushWidth,points:[pointFromEvent(event)]};activeStroke.current=stroke;const context=event.currentTarget.getContext("2d"),rect=event.currentTarget.getBoundingClientRect();if(context)drawStroke(context,stroke,rect.width,rect.height)};
  const continueDrawing=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const stroke=activeStroke.current;if(!stroke||!event.currentTarget.hasPointerCapture(event.pointerId))return;const point=pointFromEvent(event),previous=stroke.points[stroke.points.length-1];stroke.points.push(point);const context=event.currentTarget.getContext("2d"),rect=event.currentTarget.getBoundingClientRect();if(context)drawStroke(context,{...stroke,points:[previous,point]},rect.width,rect.height)};
  const finishDrawing=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const stroke=activeStroke.current;if(!stroke)return;activeStroke.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setHistory((current)=>[...current.slice(0,historyIndex+1),[...current[historyIndex],stroke]]);setHistoryIndex((current)=>current+1)};
  const clear=()=>{if(!strokes.length)return;setHistory((current)=>[...current.slice(0,historyIndex+1),[]]);setHistoryIndex((current)=>current+1)};
  const save=()=>{const canvas=canvasRef.current;if(!canvas)return;const output=document.createElement("canvas");output.width=canvas.width;output.height=canvas.height;const context=output.getContext("2d");if(!context)return;context.fillStyle="#ffffff";context.fillRect(0,0,output.width,output.height);context.drawImage(canvas,0,0);onSave("NOVA 画板.png",output.toDataURL("image/png"))};

  return <main className="drawing-app">
    <header className="drawing-toolbar">
      <div className="drawing-tools" role="group" aria-label="绘画工具">
        <button className={tool==="pen"?"active":""} aria-pressed={tool==="pen"} onClick={()=>setTool("pen")}>✎<span>画笔</span></button>
        <button className={tool==="eraser"?"active":""} aria-pressed={tool==="eraser"} onClick={()=>setTool("eraser")}>◇<span>橡皮</span></button>
      </div>
      <div className="drawing-colors" role="group" aria-label="画笔颜色">{COLORS.map((value)=><button key={value} className={color===value?"active":""} style={{"--swatch":value} as React.CSSProperties} aria-label={`选择颜色 ${value}`} aria-pressed={color===value} onClick={()=>{setColor(value);setTool("pen")}}/>)}<input type="color" aria-label="自定义画笔颜色" value={color} onChange={(event)=>{setColor(event.target.value);setTool("pen")}}/></div>
      <label className="drawing-size"><span>粗细</span><input type="range" min="2" max="36" value={brushWidth} onChange={(event)=>setBrushWidth(Number(event.target.value))}/><output>{brushWidth}</output></label>
      <div className="drawing-actions">
        <button aria-label="撤销" title="撤销" disabled={historyIndex===0} onClick={()=>setHistoryIndex((current)=>Math.max(0,current-1))}>↶</button>
        <button aria-label="重做" title="重做" disabled={historyIndex===history.length-1} onClick={()=>setHistoryIndex((current)=>Math.min(history.length-1,current+1))}>↷</button>
        <button aria-label="清空画布" title="清空画布" disabled={!strokes.length} onClick={clear}>⌫</button>
        <button className="drawing-save" onClick={save}>⇩<span>存到桌面</span></button>
      </div>
    </header>
    <section className="drawing-stage"><canvas ref={canvasRef} aria-label="画板画布" onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} onLostPointerCapture={finishDrawing}/></section>
    <footer><span>{strokes.length} 个笔画</span><span>{tool==="pen"?"画笔":"橡皮"} · {brushWidth}px</span></footer>
  </main>
}
