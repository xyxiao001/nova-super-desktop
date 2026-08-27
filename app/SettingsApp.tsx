"use client";

import { useState } from "react";
import { resetAllGameData } from "./gameStorage";
import type { NovaSettings, NovaTheme } from "./novaSettings";
import { playNovaSound } from "./novaSettings";

const THEMES:{id:NovaTheme;label:string;sample:string}[]=[
  {id:"system",label:"跟随系统",sample:"◐"},
  {id:"light",label:"明亮",sample:"○"},
  {id:"dark",label:"深色",sample:"●"},
];

export default function SettingsApp({settings,onChange}:{settings:NovaSettings;onChange:(next:NovaSettings)=>void}){
  const [confirmClear,setConfirmClear]=useState(false);
  const update=(patch:Partial<NovaSettings>)=>onChange({...settings,...patch});
  return <main className="settings-app">
    <header><strong>个性化</strong><span>桌面外观与声音</span></header>
    <section className="settings-section">
      <div><strong>主题</strong><span>应用于桌面、窗口和系统菜单</span></div>
      <div className="theme-options" role="radiogroup" aria-label="桌面主题">{THEMES.map((theme)=><button key={theme.id} role="radio" aria-checked={settings.theme===theme.id} className={settings.theme===theme.id?"active":""} onClick={()=>update({theme:theme.id})}><i className={theme.id}>{theme.sample}</i><span>{theme.label}</span></button>)}</div>
    </section>
    <section className="settings-section sound-settings">
      <div><strong>声音</strong><span>窗口操作和游戏反馈音效</span></div>
      <button className="settings-switch" role="switch" aria-checked={settings.sound} onClick={()=>update({sound:!settings.sound})}><i/><span>{settings.sound?"已开启":"已关闭"}</span></button>
      <label className={settings.sound?"":"disabled"}><span>音量</span><input type="range" min="0" max="1" step=".05" disabled={!settings.sound} value={settings.volume} onChange={(event)=>update({volume:Number(event.target.value)})}/><output>{Math.round(settings.volume*100)}%</output></label>
      <button disabled={!settings.sound} onClick={()=>playNovaSound("success")}>测试声音</button>
    </section>
    <section className="settings-section data-settings">
      <div><strong>本地游戏数据</strong><span>清除所有存档、最近游玩和胜负记录</span></div>
      <button className={confirmClear?"confirm":""} onClick={()=>{if(confirmClear){resetAllGameData();setConfirmClear(false)}else setConfirmClear(true)}}>{confirmClear?"确认清除":"清除游戏记录"}</button>
    </section>
  </main>
}
