"use client";

import { useState } from "react";
import AppShareButton from "../../platform/apps/AppShareButton";
import CyberCity from "./CyberCity";
import { CITY_LOCATIONS } from "./cityLayout";
import { CYBER_ROOMS, type CyberRoomId } from "./interiors";
import "./cybercity.css";

export default function CyberCityApp() {
  const [location,setLocation]=useState(0),[travel,setTravel]=useState(0);
  const [room,setRoom]=useState<CyberRoomId|null>(null);
  const [quality,setQuality]=useState<"high"|"balanced">("high");
  const [hover,setHover]=useState<string|null>(null),[message,setMessage]=useState("");
  const [help,setHelp]=useState(false),[paused,setPaused]=useState(false);
  const enter=(id:CyberRoomId|null)=>{setRoom(id);setMessage("");setHover(null);};
  return <main className="cybercity-experience" aria-label="赛博城市">
    <CyberCity active={!paused} location={location} travel={travel} room={room} quality={quality} onRoom={enter} onMessage={setMessage} onHover={setHover}/>
    <header className="city-hud"><div><small>NOVA EXPERIENCES / 07</small><h1>赛博城市</h1><span>{room?CYBER_ROOMS[room].title:"夜城 · 滨水街区"}</span></div>
      <div className="city-tools"><AppShareButton app="cybercity"/><label>画质<select aria-label="城市画质" value={quality} onChange={event=>setQuality(event.target.value as "high"|"balanced")}><option value="high">清晰</option><option value="balanced">均衡</option></select></label><button aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?"继续探索":"暂停"}</button><button aria-expanded={help} onClick={()=>setHelp(value=>!value)}>操作指南</button></div>
    </header>
    {help&&<aside className="city-help"><header><strong>在城市里慢慢走</strong><button aria-label="关闭操作指南" onClick={()=>setHelp(false)}>×</button></header><p>拖动观察，WASD 或方向键漫游。双击地面，会移动到那个位置。</p><p>点击入口进入店铺；点击座椅入座，点击灯光面板和装置与它们互动。也可以瞄准后按 E。</p><a href="/?app=cybercity" target="_blank" rel="noreferrer">在独立页面体验 / 分享此链接 ↗</a></aside>}
    <div className="city-crosshair" aria-hidden="true"/>
    {hover&&!paused&&<div className="city-target" role="status"><strong>{hover}</strong><span>点击 / E 交互</span></div>}
    {message&&<aside className="city-message" role="status"><p>{message}</p><button aria-label="关闭城市信息" onClick={()=>setMessage("")}>×</button></aside>}
    {paused&&<div className="city-paused"><strong>停在这一刻</strong><button onClick={()=>setPaused(false)}>继续探索 ↗</button></div>}
    <footer className="city-navigation">
      {room?<div className="city-room-bar"><span><strong>{CYBER_ROOMS[room].title}</strong><small>{CYBER_ROOMS[room].detail}</small></span><button onClick={()=>enter(null)}>返回街道 ↗</button></div>:<>
        <div className="city-door-links"><span>可进入的店铺</span><button onClick={()=>enter("ramen")}>夜食 · 深夜食堂 ↗</button><button onClick={()=>enter("workshop")}>NEURAL · 义体工坊 ↗</button></div>
        <nav aria-label="城市观景点">{CITY_LOCATIONS.map((point,index)=><button key={point.id} aria-label={`前往${point.label}`} aria-pressed={location===index} onClick={()=>{setLocation(index);setTravel(value=>value+1);setMessage("");}}><small>{String(index+1).padStart(2,"0")}</small>{point.label}</button>)}</nav>
      </>}
      <small className="city-controls-hint">拖动环顾 · WASD 行走 · 双击地面前往 · E 交互</small>
    </footer>
  </main>;
}
