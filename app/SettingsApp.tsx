"use client";

import { useEffect, useRef, useState } from "react";
import type { AppLaunchIntent } from "./appLaunch";
import { resetAllGameData } from "./gameStorage";
import {
  createNovaBackup,
  estimateNovaStorage,
  parseNovaBackup,
  restoreNovaBackup,
  summarizeNovaBackup,
  type NovaBackup,
} from "./novaBackup";
import type { NovaSettings, NovaTheme } from "./novaSettings";
import { playNovaSound } from "./novaSettings";

const THEMES:{id:NovaTheme;label:string;sample:string}[]=[
  {id:"system",label:"跟随系统",sample:"◐"},
  {id:"light",label:"明亮",sample:"○"},
  {id:"dark",label:"深色",sample:"●"},
];

const formatBytes=(bytes:number)=>{
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`;
  if(bytes<1024*1024*1024)return `${(bytes/1024/1024).toFixed(1)} MB`;
  return `${(bytes/1024/1024/1024).toFixed(1)} GB`;
};

export default function SettingsApp({
  settings,
  launchIntent,
  onLaunchHandled,
  onChange,
}: {
  settings: NovaSettings;
  launchIntent: Extract<AppLaunchIntent, { app: "settings" }> | null;
  onLaunchHandled: (requestId: number) => void;
  onChange: (next: NovaSettings) => void;
}){
  const [confirmClear,setConfirmClear]=useState(false);
  const [storage,setStorage]=useState({usage:0,quota:0});
  const [backupState,setBackupState]=useState<"idle"|"exporting"|"restoring">("idle");
  const [backupMessage,setBackupMessage]=useState("");
  const [pendingBackup,setPendingBackup]=useState<NovaBackup|null>(null);
  const [focusedSection,setFocusedSection]=useState("");
  const backupInputRef=useRef<HTMLInputElement>(null);
  const appRef=useRef<HTMLElement>(null);
  const focusTimerRef=useRef<number|null>(null);
  const update=(patch:Partial<NovaSettings>)=>onChange({...settings,...patch});
  const refreshStorage=()=>void estimateNovaStorage().then(setStorage);
  useEffect(refreshStorage,[]);
  const exportBackup=async()=>{
    setBackupState("exporting");
    setBackupMessage("");
    try{
      const backup=await createNovaBackup();
      const url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:"application/json"}));
      const link=document.createElement("a");
      link.href=url;
      link.download=`nova-backup-${backup.exportedAt.slice(0,10)}.json`;
      link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setBackupMessage("本地备份已导出");
    }catch{
      setBackupMessage("备份导出失败");
    }finally{
      setBackupState("idle");
      refreshStorage();
    }
  };
  const chooseBackup=async(file:File)=>{
    setBackupMessage("");
    try{
      setPendingBackup(parseNovaBackup(await file.text()));
    }catch(error){
      setPendingBackup(null);
      setBackupMessage(error instanceof Error?error.message:"备份文件无法读取");
    }
  };
  const confirmRestore=async()=>{
    if(!pendingBackup)return;
    setBackupState("restoring");
    setBackupMessage("");
    try{
      await restoreNovaBackup(pendingBackup);
      window.location.reload();
    }catch{
      setBackupState("idle");
      setBackupMessage("恢复失败，本地数据未完全更新");
    }
  };
  const backupSummary=pendingBackup?summarizeNovaBackup(pendingBackup):null;
  const storagePercent=storage.quota?Math.min(100,storage.usage/storage.quota*100):0;
  useEffect(()=>{
    if(!launchIntent)return;
    setFocusedSection(launchIntent.sectionId);
    requestAnimationFrame(()=>appRef.current?.querySelector<HTMLElement>(`[data-settings-section="${launchIntent.sectionId}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}));
    if(focusTimerRef.current)window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current=window.setTimeout(()=>setFocusedSection(""),1800);
    onLaunchHandled(launchIntent.requestId);
  },[launchIntent,onLaunchHandled]);
  useEffect(()=>()=>{if(focusTimerRef.current)window.clearTimeout(focusTimerRef.current)},[]);
  const sectionClass=(id:string)=>`settings-section ${focusedSection===id?"search-focus":""}`;
  return <main ref={appRef} className="settings-app">
    <header><strong>个性化</strong><span>桌面外观与声音</span></header>
    <section className={sectionClass("theme")} data-settings-section="theme">
      <div><strong>主题</strong><span>应用于桌面、窗口和系统菜单</span></div>
      <div className="theme-options" role="radiogroup" aria-label="桌面主题">{THEMES.map((theme)=><button key={theme.id} role="radio" aria-checked={settings.theme===theme.id} className={settings.theme===theme.id?"active":""} onClick={()=>update({theme:theme.id})}><i className={theme.id}>{theme.sample}</i><span>{theme.label}</span></button>)}</div>
    </section>
    <section className={`${sectionClass("sound")} sound-settings`} data-settings-section="sound">
      <div><strong>声音</strong><span>窗口操作和游戏反馈音效</span></div>
      <button className="settings-switch" role="switch" aria-checked={settings.sound} onClick={()=>update({sound:!settings.sound})}><i/><span>{settings.sound?"已开启":"已关闭"}</span></button>
      <label className={settings.sound?"":"disabled"}><span>音量</span><input type="range" min="0" max="1" step=".05" disabled={!settings.sound} value={settings.volume} onChange={(event)=>update({volume:Number(event.target.value)})}/><output>{Math.round(settings.volume*100)}%</output></label>
      <button disabled={!settings.sound} onClick={()=>playNovaSound("success")}>测试声音</button>
    </section>
    <section className={`${sectionClass("games")} data-settings`} data-settings-section="games">
      <div><strong>本地游戏数据</strong><span>清除所有存档、最近游玩和胜负记录</span></div>
      <button className={confirmClear?"confirm":""} onClick={()=>{if(confirmClear){resetAllGameData();setConfirmClear(false)}else setConfirmClear(true)}}>{confirmClear?"确认清除":"清除游戏记录"}</button>
    </section>
    <section className={`${sectionClass("backup")} backup-settings`} data-settings-section="backup">
      <div><strong>本地数据</strong><span>{formatBytes(storage.usage)} 已使用{storage.quota?` · ${formatBytes(storage.quota)} 可用空间`:""}</span></div>
      <div className="storage-meter" aria-label={`存储空间已使用 ${Math.round(storagePercent)}%`}><i style={{width:`${storagePercent}%`}}/></div>
      <div className="backup-actions">
        <button disabled={backupState!=="idle"} onClick={()=>void exportBackup()}>⇩ 导出备份</button>
        <button disabled={backupState!=="idle"} onClick={()=>backupInputRef.current?.click()}>⇧ 导入备份</button>
        <input ref={backupInputRef} type="file" accept="application/json,.json" aria-label="选择 NOVA 备份" onChange={(event)=>{const file=event.target.files?.[0];if(file)void chooseBackup(file);event.target.value=""}}/>
      </div>
      {backupMessage&&<p className="settings-data-message" role="status">{backupMessage}</p>}
    </section>
    {pendingBackup&&backupSummary&&<div className="settings-restore-layer">
      <section role="dialog" aria-modal="true" aria-label="确认恢复本地备份">
        <strong>恢复本地备份？</strong>
        <p>{new Intl.DateTimeFormat("zh-CN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(backupSummary.exportedAt))}</p>
        <dl><div><dt>桌面项目</dt><dd>{backupSummary.desktopItems}</dd></div><div><dt>阅读书籍</dt><dd>{backupSummary.readerBooks}</dd></div><div><dt>设置与记录</dt><dd>{backupSummary.localSettings}</dd></div></dl>
        <small>当前本地数据将被此备份替换。</small>
        <footer><button onClick={()=>setPendingBackup(null)}>取消</button><button className="danger" disabled={backupState==="restoring"} onClick={()=>void confirmRestore()}>{backupState==="restoring"?"正在恢复":"确认恢复"}</button></footer>
      </section>
    </div>}
  </main>
}
