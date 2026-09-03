"use client";

import "./settings.css";

import { useEffect, useRef, useState } from "react";
import {
  createNovaBackup,
  estimateNovaStorage,
  parseNovaBackup,
  restoreNovaBackup,
  summarizeNovaBackup,
  type NovaBackup,
} from "../../../app/novaBackup";
import type { NovaSettings, NovaTheme, NovaWallpaper } from "../../../app/novaSettings";
import { playNovaSound } from "../../../app/novaSettings";
import {
  clearAllResourceCaches,
  clearResourceCache,
  inspectResourceCaches,
  type NovaResourcePackage,
} from "../../../app/resourceCache";
import {
  clearAllNovaStorage,
  clearNovaStorageCategory,
  inspectNovaStorage,
  type NovaStorageCategory,
} from "../../../app/novaStorage";
import { useAppLaunchIntent } from "../../platform/launch/LaunchRuntime";
import { useSettingsRuntime } from "../../platform/settings/SettingsRuntime";

const THEMES:{id:NovaTheme;label:string;sample:string}[]=[
  {id:"system",label:"跟随系统",sample:"◐"},
  {id:"light",label:"明亮",sample:"○"},
  {id:"dark",label:"深色",sample:"●"},
];
const WALLPAPERS:{id:NovaWallpaper;label:string;detail:string}[]=[
  {id:"nova",label:"NOVA 流光",detail:"清透蓝色几何光带"},
  {id:"harbor",label:"港湾",detail:"冷灰与暖金交错"},
  {id:"dawn",label:"晨曦",detail:"珊瑚色晨光"},
  {id:"grove",label:"青屿",detail:"林木与日光"},
  {id:"dusk",label:"暮色",detail:"深蓝与晚霞"},
  {id:"graphite",label:"石墨",detail:"克制的中性色"},
  {id:"starport",label:"星港观测站",detail:"星云、轨道与远行流星"},
  {id:"rain",label:"玻璃雨夜",detail:"霓虹城市与窗上细雨"},
  {id:"abyss",label:"深海舷窗",detail:"水下光束与漂浮生物"},
];
const SETTINGS_PANES=[
  {id:"appearance",label:"外观",detail:"主题与桌面壁纸",icon:"◫"},
  {id:"sound",label:"声音",detail:"反馈音效与音量",icon:"♫"},
  {id:"storage",label:"存储",detail:"数据、资源与备份",icon:"▤"},
] as const;
type SettingsPane=typeof SETTINGS_PANES[number]["id"];

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

export default function SettingsApp(){
  const {settings,updateSettings:onChange}=useSettingsRuntime();
  const {launchIntent,onLaunchHandled}=useAppLaunchIntent("settings");
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
  const [activePane,setActivePane]=useState<SettingsPane>("appearance");
  const [expandedStorage,setExpandedStorage]=useState<"data"|"resources"|null>(null);
  const [resetOpen,setResetOpen]=useState(false);
  const [resetting,setResetting]=useState(false);
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
      setPendingBackup(await parseNovaBackup(await file.text()));
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
  const confirmResetAll=async()=>{
    setResetting(true);
    setBackupMessage("");
    try{
      if(resourcePackages.some((resource)=>resource.entries>0))await clearAllResourceCaches();
      await clearAllNovaStorage();
      window.location.replace(window.location.pathname);
    }catch{
      setResetting(false);
      setResetOpen(false);
      setBackupMessage("重置失败，用户数据未开始清除或未完全更新");
      void refreshStorage();
    }
  };
  const backupSummary=pendingBackup?summarizeNovaBackup(pendingBackup):null;
  const dataBytes=storageCategories.reduce((total,item)=>total+item.bytes,0);
  const resourceBytes=resourcePackages.reduce((total,item)=>total+item.bytes,0);
  const otherBytes=Math.max(0,storage.usage-dataBytes-resourceBytes);
  const resetEntries=storageCategories.reduce((total,item)=>total+item.entries,0)+resourcePackages.reduce((total,item)=>total+item.entries,0);
  const activePaneMeta=SETTINGS_PANES.find((pane)=>pane.id===activePane)??SETTINGS_PANES[0];
  const sectionPane=(sectionId:string):SettingsPane=>sectionId==="sound"?"sound":sectionId==="backup"?"storage":"appearance";
  useEffect(()=>{
    if(!launchIntent)return;
    const frame=window.requestAnimationFrame(()=>{
      setActivePane(sectionPane(launchIntent.sectionId));
      setFocusedSection(launchIntent.sectionId);
      window.requestAnimationFrame(()=>appRef.current?.querySelector<HTMLElement>(`[data-settings-section="${launchIntent.sectionId}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}));
      if(focusTimerRef.current)window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current=window.setTimeout(()=>setFocusedSection(""),1800);
    });
    onLaunchHandled(launchIntent.requestId);
    return()=>window.cancelAnimationFrame(frame);
  },[launchIntent,onLaunchHandled]);
  useEffect(()=>()=>{if(focusTimerRef.current)window.clearTimeout(focusTimerRef.current)},[]);
  const sectionClass=(id:string)=>`settings-section ${focusedSection===id?"search-focus":""}`;
  return <main ref={appRef} className="settings-app">
    <header><div><strong>设置</strong><span>{activePaneMeta.detail}</span></div><b aria-hidden="true">{activePaneMeta.icon}</b></header>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="设置分类">{SETTINGS_PANES.map((pane)=><button key={pane.id} className={activePane===pane.id?"active":""} aria-current={activePane===pane.id?"page":undefined} onClick={()=>setActivePane(pane.id)}><i aria-hidden="true">{pane.icon}</i><span><strong>{pane.label}</strong><small>{pane.detail}</small></span><b aria-hidden="true">›</b></button>)}</nav>
      <div className="settings-scroll">
        {activePane==="appearance"&&<>
          <section className={sectionClass("theme")} data-settings-section="theme">
            <div className="settings-section-heading"><strong>桌面壁纸</strong><span>选择一套本地生成的几何场景</span></div>
            <div className="wallpaper-options" role="radiogroup" aria-label="桌面壁纸">{WALLPAPERS.map((wallpaper)=><button key={wallpaper.id} role="radio" aria-checked={settings.wallpaper===wallpaper.id} className={settings.wallpaper===wallpaper.id?"active":""} onClick={()=>update({wallpaper:wallpaper.id})}><i className={`wallpaper-preview ${wallpaper.id}`} aria-hidden="true"><span/><span/><span/></i><span><strong>{wallpaper.label}</strong><small>{wallpaper.detail}</small></span></button>)}</div>
          </section>
          <section className="settings-section">
            <div className="settings-section-heading"><strong>界面主题</strong><span>应用于窗口、菜单和控件</span></div>
            <div className="theme-options" role="radiogroup" aria-label="桌面主题">{THEMES.map((theme)=><button key={theme.id} role="radio" aria-checked={settings.theme===theme.id} className={settings.theme===theme.id?"active":""} onClick={()=>update({theme:theme.id})}><i className={theme.id}>{theme.sample}</i><span>{theme.label}</span></button>)}</div>
          </section>
        </>}
        {activePane==="sound"&&<section className={`${sectionClass("sound")} sound-settings`} data-settings-section="sound">
          <div className="settings-section-heading"><strong>声音反馈</strong><span>窗口操作、文件动作和游戏提示音</span></div>
          <div className="settings-control-list">
            <div className="settings-control-row"><span><strong>系统音效</strong><small>开启操作反馈声音</small></span><button className="settings-switch" role="switch" aria-label="系统音效" aria-checked={settings.sound} onClick={()=>update({sound:!settings.sound})}><i/><span>{settings.sound?"开启":"关闭"}</span></button></div>
            <label className={`settings-control-row volume-row ${settings.sound?"":"disabled"}`}><span><strong>音量</strong><small>控制所有 NOVA 音效</small></span><input type="range" min="0" max="1" step=".05" disabled={!settings.sound} value={settings.volume} onChange={(event)=>update({volume:Number(event.target.value)})}/><output>{Math.round(settings.volume*100)}%</output></label>
          </div>
          <button className="sound-preview-button" disabled={!settings.sound} onClick={()=>playNovaSound("success")}>试听提示音</button>
        </section>}
        {activePane==="storage"&&<section className={`${sectionClass("backup")} backup-settings`} data-settings-section="backup">
          <div className="settings-section-heading"><strong>存储概览</strong><span>本地数据与可重新下载的资源分开管理</span></div>
          <div className="storage-overview" aria-busy={storageLoading}>
            <div className="storage-total"><span>{storageLoading?"正在统计":"本地占用"}</span><strong>{formatBytes(storage.usage)}</strong><small>{storage.quota?`浏览器配额 ${formatBytes(storage.quota)}`:"仅保存在当前设备"}</small></div>
            <div className="storage-summary-grid">
              <article><i className="data"/><span>用户数据</span><strong>{formatBytes(dataBytes)}</strong></article>
              <article><i className="resources"/><span>按需资源</span><strong>{formatBytes(resourceBytes)}</strong></article>
              <article><i className="other"/><span>其他占用</span><strong>{formatBytes(otherBytes)}</strong></article>
            </div>
            <div className="storage-distribution" aria-label={`本地占用构成：用户数据 ${formatBytes(dataBytes)}，按需资源 ${formatBytes(resourceBytes)}，其他 ${formatBytes(otherBytes)}`}><i className="data" style={{flexGrow:dataBytes}}/><i className="resources" style={{flexGrow:resourceBytes}}/><i className="other" style={{flexGrow:otherBytes}}/></div>
          </div>
          <div className="storage-groups">
            <section>
              <button className="storage-group-toggle" aria-expanded={expandedStorage==="data"} onClick={()=>setExpandedStorage((current)=>current==="data"?null:"data")}><i className="data" aria-hidden="true">●</i><span><strong>用户数据</strong><small>{storageCategories.length} 类 · 删除后不可恢复</small></span><output>{formatBytes(dataBytes)}</output><b aria-hidden="true">›</b></button>
              {expandedStorage==="data"&&<div className="storage-list" aria-busy={storageLoading}>{storageLoading&&!storageCategories.length?<p>正在统计本地数据…</p>:storageCategories.map((category)=><article key={category.id}><span className={`storage-kind ${category.id}`} aria-hidden="true"/><div><strong>{category.label}</strong><small>{category.description}</small></div><output>{formatBytes(category.bytes)}</output><button disabled={!category.canClear||clearing} aria-label={`清除${category.label}`} onClick={()=>setClearTarget({kind:"data",item:category})}>清除</button></article>)}</div>}
            </section>
            <section>
              <button className="storage-group-toggle" aria-expanded={expandedStorage==="resources"} onClick={()=>setExpandedStorage((current)=>current==="resources"?null:"resources")}><i className="resources" aria-hidden="true">↓</i><span><strong>按需资源</strong><small>{resourcePackages.length} 个资源包 · 可重新下载</small></span><output>{formatBytes(resourceBytes)}</output><b aria-hidden="true">›</b></button>
              {expandedStorage==="resources"&&<div className="storage-list resource-list" aria-busy={storageLoading}>{storageLoading&&!resourcePackages.length?<p>正在统计应用资源…</p>:resourcePackages.length?resourcePackages.map((resource)=><article key={resource.id}><span className={`storage-kind resource ${resource.id}`} aria-hidden="true"/><div><strong>{resource.label}</strong><small>{resource.entries?`${resource.description} · ${resource.entries} 个文件`:`${resource.description} · 尚未下载`}</small></div><output>{formatBytes(resource.bytes)}</output><button disabled={!resource.entries||clearing} aria-label={`删除${resource.label}`} onClick={()=>setClearTarget({kind:"resource",item:resource})}>清除</button></article>):<p>{resourceUnavailable?"资源缓存状态暂不可用，更新或重载后重试":"按需资源缓存会在安装版中启用"}</p>}</div>}
            </section>
          </div>
          <div className="settings-backup-panel"><span><strong>本地备份</strong><small>导出或恢复桌面文件、书籍、日程与设置</small></span><div className="backup-actions"><button disabled={backupState!=="idle"} onClick={()=>void exportBackup()}>⇩ 导出</button><button disabled={backupState!=="idle"} onClick={()=>backupInputRef.current?.click()}>⇧ 导入</button><input ref={backupInputRef} type="file" accept="application/json,.json" aria-label="选择 NOVA 备份" onChange={(event)=>{const file=event.target.files?.[0];if(file)void chooseBackup(file);event.target.value=""}}/></div></div>
          <div className="settings-reset-panel"><span><strong>重置 NOVA</strong><small>删除所有用户数据、设置和已下载资源</small></span><button disabled={resetting||storageLoading} onClick={()=>setResetOpen(true)}>删除所有数据</button></div>
          {backupMessage&&<p className="settings-data-message" role="status">{backupMessage}</p>}
        </section>}
      </div>
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
    {resetOpen&&<div className="settings-restore-layer">
      <section role="dialog" aria-modal="true" aria-label="确认删除所有 NOVA 数据">
        <strong>删除所有数据并重置 NOVA？</strong>
        <p>桌面文件、离线书籍、日历日程、存档、阅读记录、偏好设置和按需资源都将从当前设备删除。</p>
        <dl className="settings-clear-summary"><div><dt>数据与资源项</dt><dd>{resetEntries}</dd></div><div><dt>已识别占用</dt><dd>{formatBytes(dataBytes+resourceBytes)}</dd></div></dl>
        <small>此操作无法撤销。需要保留内容时，请先导出本地备份。</small>
        <footer><button disabled={resetting} onClick={()=>setResetOpen(false)}>取消</button><button className="danger" disabled={resetting} onClick={()=>void confirmResetAll()}>{resetting?"正在重置":"删除并重置"}</button></footer>
      </section>
    </div>}
    {pendingBackup&&backupSummary&&<div className="settings-restore-layer">
      <section role="dialog" aria-modal="true" aria-label="确认恢复本地备份">
        <strong>恢复本地备份？</strong>
        <p>{new Intl.DateTimeFormat("zh-CN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(backupSummary.exportedAt))}</p>
        <dl><div><dt>桌面项目</dt><dd>{backupSummary.desktopItems}</dd></div><div><dt>阅读书籍</dt><dd>{backupSummary.readerBooks}</dd></div><div><dt>日历日程</dt><dd>{backupSummary.calendarEvents}</dd></div><div><dt>设置与记录</dt><dd>{backupSummary.localSettings}</dd></div></dl>
        <small>当前本地数据将被此备份替换。</small>
        <footer><button onClick={()=>setPendingBackup(null)}>取消</button><button className="danger" disabled={backupState==="restoring"} onClick={()=>void confirmRestore()}>{backupState==="restoring"?"正在恢复":"确认恢复"}</button></footer>
      </section>
    </div>}
  </main>
}
