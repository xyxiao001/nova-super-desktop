"use client";

import "./games-tools.css";

import { useEffect, useRef, useState } from "react";
import type { AppLaunchIntent } from "./appLaunch";
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
import {
  clearResourceCache,
  inspectResourceCaches,
  type NovaResourcePackage,
} from "./resourceCache";
import {
  clearNovaStorageCategory,
  inspectNovaStorage,
  type NovaStorageCategory,
} from "./novaStorage";

const THEMES:{id:NovaTheme;label:string;sample:string}[]=[
  {id:"system",label:"跟随系统",sample:"◐"},
  {id:"light",label:"明亮",sample:"○"},
  {id:"dark",label:"深色",sample:"●"},
];

type ClearTarget =
  | { kind: "data"; item: NovaStorageCategory }
  | { kind: "resource"; item: NovaResourcePackage };

const formatBytes=(bytes:number)=>{
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`;
  if(bytes<1024*1024*1024)return `${(bytes/1024/1024).toFixed(1)} MB`;
  return `${(bytes/1024/1024/1024).toFixed(1)} GB`;
};

const inspectResourceCacheState=()=>inspectResourceCaches()
  .then((resources)=>({resources,unavailable:false}))
  .catch(()=>({resources:[] as NovaResourcePackage[],unavailable:true}));

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
  const [storage,setStorage]=useState({usage:0,quota:0});
  const [storageCategories,setStorageCategories]=useState<NovaStorageCategory[]>([]);
  const [resourcePackages,setResourcePackages]=useState<NovaResourcePackage[]>([]);
  const [resourceUnavailable,setResourceUnavailable]=useState(false);
  const [storageLoading,setStorageLoading]=useState(true);
  const [clearTarget,setClearTarget]=useState<ClearTarget|null>(null);
  const [clearing,setClearing]=useState(false);
  const [backupState,setBackupState]=useState<"idle"|"exporting"|"restoring">("idle");
  const [backupMessage,setBackupMessage]=useState("");
  const [pendingBackup,setPendingBackup]=useState<NovaBackup|null>(null);
  const [focusedSection,setFocusedSection]=useState("");
  const backupInputRef=useRef<HTMLInputElement>(null);
  const appRef=useRef<HTMLElement>(null);
  const focusTimerRef=useRef<number|null>(null);
  const update=(patch:Partial<NovaSettings>)=>onChange({...settings,...patch});
  const refreshStorage=async()=>{
    setStorageLoading(true);
    try{
      const [estimate,categories,resourceResult]=await Promise.all([
        estimateNovaStorage(),
        inspectNovaStorage(),
        inspectResourceCacheState(),
      ]);
      setStorage(estimate);
      setStorageCategories(categories);
      setResourcePackages(resourceResult.resources);
      setResourceUnavailable(resourceResult.unavailable);
    }catch{
      setBackupMessage("本地数据读取失败");
    }finally{
      setStorageLoading(false);
    }
  };
  useEffect(()=>{
    let cancelled=false;
    void Promise.all([
      estimateNovaStorage(),
      inspectNovaStorage(),
      inspectResourceCacheState(),
    ]).then(([estimate,categories,resourceResult])=>{
      if(cancelled)return;
      setStorage(estimate);
      setStorageCategories(categories);
      setResourcePackages(resourceResult.resources);
      setResourceUnavailable(resourceResult.unavailable);
    }).catch(()=>{
      if(!cancelled)setBackupMessage("本地数据读取失败");
    }).finally(()=>{
      if(!cancelled)setStorageLoading(false);
    });
    return()=>{cancelled=true};
  },[]);
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
      void refreshStorage();
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
  const confirmClearStorage=async()=>{
    if(!clearTarget)return;
    setClearing(true);
    setBackupMessage("");
    try{
      if(clearTarget.kind==="data"){
        await clearNovaStorageCategory(clearTarget.item.id);
        window.location.reload();
        return;
      }
      await clearResourceCache(clearTarget.item.id);
      setClearTarget(null);
      setBackupMessage(`${clearTarget.item.label}已删除，需要时会重新下载`);
      await refreshStorage();
    }catch{
      setBackupMessage(`${clearTarget.item.label}清除失败`);
    }finally{
      setClearing(false);
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
    <div className="settings-scroll">
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
      <section className={`${sectionClass("backup")} backup-settings`} data-settings-section="backup">
        <div><strong>存储管理</strong><span>{formatBytes(storage.usage)} 已使用{storage.quota?` · ${formatBytes(storage.quota)} 可用空间`:""}</span></div>
        <div className="storage-meter" aria-label={`存储空间已使用 ${Math.round(storagePercent)}%`}><i style={{width:`${storagePercent}%`}}/></div>
        <div className="storage-group-heading"><strong>用户数据</strong><span>文件、存档和偏好仅保存在当前设备，删除后不可恢复</span></div>
        <div className="storage-list" aria-busy={storageLoading}>
          {storageLoading&&!storageCategories.length?<p>正在统计本地数据…</p>:storageCategories.map((category)=><article key={category.id}>
            <span className={`storage-kind ${category.id}`} aria-hidden="true"/>
            <div><strong>{category.label}</strong><small>{category.description}</small></div>
            <output>{formatBytes(category.bytes)}</output>
            <button disabled={!category.canClear||clearing} aria-label={`清除${category.label}`} onClick={()=>setClearTarget({kind:"data",item:category})}>删除</button>
          </article>)}
        </div>
        <div className="storage-group-heading resource-heading"><strong>按需资源</strong><span>应用和内容在首次使用时下载，可删除并在下次打开时重新获取</span></div>
        <div className="storage-list resource-list" aria-busy={storageLoading}>
          {storageLoading&&!resourcePackages.length?<p>正在统计应用资源…</p>:resourcePackages.length?resourcePackages.map((resource)=><article key={resource.id}>
            <span className={`storage-kind resource ${resource.id}`} aria-hidden="true"/>
            <div><strong>{resource.label}</strong><small>{resource.entries?`${resource.description} · ${resource.entries} 个文件`:`${resource.description} · 尚未下载`}</small></div>
            <output>{formatBytes(resource.bytes)}</output>
            <button disabled={!resource.entries||clearing} aria-label={`删除${resource.label}`} onClick={()=>setClearTarget({kind:"resource",item:resource})}>删除</button>
          </article>):<p>{resourceUnavailable?"资源缓存状态暂不可用，更新或重载后重试":"按需资源缓存会在安装版中启用"}</p>}
        </div>
        <div className="backup-actions">
          <button disabled={backupState!=="idle"} onClick={()=>void exportBackup()}>⇩ 导出备份</button>
          <button disabled={backupState!=="idle"} onClick={()=>backupInputRef.current?.click()}>⇧ 导入备份</button>
          <input ref={backupInputRef} type="file" accept="application/json,.json" aria-label="选择 NOVA 备份" onChange={(event)=>{const file=event.target.files?.[0];if(file)void chooseBackup(file);event.target.value=""}}/>
        </div>
        {backupMessage&&<p className="settings-data-message" role="status">{backupMessage}</p>}
      </section>
    </div>
    {clearTarget&&<div className="settings-restore-layer">
      <section role="dialog" aria-modal="true" aria-label={`确认清除${clearTarget.item.label}`}>
        <strong>删除{clearTarget.item.label}？</strong>
        <p>{clearTarget.kind==="resource"?"只删除已下载资源，不影响文件、存档和设置；下次打开时会重新下载。":"该数据将从当前设备永久删除，操作后桌面会刷新。"}</p>
        <dl className="settings-clear-summary"><div><dt>{clearTarget.kind==="resource"?"缓存文件":"数据项"}</dt><dd>{clearTarget.item.entries}</dd></div><div><dt>预计释放</dt><dd>{formatBytes(clearTarget.item.bytes)}</dd></div></dl>
        <small>{clearTarget.kind==="resource"?"离线时将暂时无法使用对应内容。":"此操作无法撤销，建议先导出备份。"}</small>
        <footer><button disabled={clearing} onClick={()=>setClearTarget(null)}>取消</button><button className="danger" disabled={clearing} onClick={()=>void confirmClearStorage()}>{clearing?"正在清除":"确认清除"}</button></footer>
      </section>
    </div>}
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
