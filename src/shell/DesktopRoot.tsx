"use client";

import { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { notifyWindowClosing, windowIsActive, WindowRuntimeProvider } from "../platform/windows/WindowRuntime";
import StartMenu from "../../app/StartMenu";
import {
  APP_REGISTRY,
  LAUNCHER_APPS,
  REGISTERED_APPS,
  type AppDefinition,
  type WindowAppId,
} from "../platform/apps/appRegistry";
import {
  createAppLaunchIntent,
  type AppLaunchIntent,
  type AppLaunchTarget,
} from "../../app/appLaunch";
import {
  applyDesktopFileOperation,
  desktopFileDragMode,
  desktopFileOperationConflicts,
  descendantIds,
  hasDesktopFileDrag,
  permanentlyDeleteDesktopItems,
  readDesktopFileDragIds,
  recycleBinItems,
  replaceDesktopImage,
  restoreDesktopItems,
  topLevelDesktopItemIds,
  trashDesktopItems,
  visibleDesktopItems,
  writeDesktopFileDragIds,
  type DesktopItem,
  type FileClipboard,
  type FileConflictStrategy,
  type FileOperationMode,
} from "../../app/desktopFiles";
import { createDesktopSyncQueue, loadDesktopWorkspace } from "../../app/desktopStorage";
import {
  createDesktopObject,
  moveDesktopObject,
  readDesktopObjects,
  removeDesktopObjects,
  saveDesktopObjects,
  visibleDesktopObjects,
  type DesktopObjectMap,
} from "../../app/desktopObjects";
import {
  appendDesktopNotification,
  calendarDays,
  type DesktopNotification,
} from "../../app/desktopSystem";
import {
  clearSystemMoment,
  replaceSystemMoment,
  subscribeNovaSystemMoments,
  type NovaSystemMoment,
} from "../../app/systemMoments";
import {
  defaultFileOpenApp,
  fileOpenOptions,
  type FileOpenApp,
} from "../../app/fileAssociations";
import { playNovaSound, readNovaSettings, saveNovaSettings, type NovaSettings } from "../../app/novaSettings";
import type { StoredBookSummary } from "../apps/reader/readerCore";
import { getStoredBookSummaries } from "../apps/reader/readerStorage";
import {
  windowShortcutAction,
  type WindowSnapMode,
} from "../platform/windows/windowGeometry";
import {
  isCompactDesktopViewport,
  isMobileSearchPull,
  reorderDesktopIconIds,
} from "../../app/desktopIconInteraction";
import {
  allWindowInstances,
  createWindowInstanceId,
  createInitialWindowInstanceManagerState,
  findResourceWindowInstance,
  instancesForApp,
  selectResourceWindowInstance,
  singletonWindowInstanceId,
  windowInstanceReducer,
  type WindowInstance,
  type WindowInstanceId,
  type WindowInstancePatch,
  type WindowInstanceTarget,
} from "../platform/windows/windowInstanceState";
import AppHost from "../platform/apps/AppHost";
import {
  LaunchRuntimeProvider,
  type LaunchRuntimeValue,
} from "../platform/launch/LaunchRuntime";
import {
  SettingsRuntimeProvider,
  type SettingsRuntimeValue,
} from "../platform/settings/SettingsRuntime";
import {
  WorkspaceRuntimeProvider,
  type WorkspacePhotoSource,
  type WorkspaceRuntimeValue,
} from "../platform/workspace/WorkspaceRuntime";
import DesktopCreativeObjects from "./DesktopCreativeObjects";
import { DesktopFile, DesktopShortcut, type IconPosition } from "./DesktopIcons";
import DesktopMomentLayer from "./DesktopMomentLayer";
import DesktopOverlays, { type PendingFileOperation } from "./DesktopOverlays";
import DesktopSystemPanel from "./DesktopSystemPanel";
import DesktopTaskbar, { type TaskbarMenuState } from "./DesktopTaskbar";

type ContextMenuState = { x: number; y: number; itemId?: string; appKey?: WindowAppId };
type AltTabState = { instances:WindowInstanceId[]; active:WindowInstanceId };
type FileUndoAction = {
  items: DesktopItem[];
  positions: Record<string, IconPosition>;
  objects: DesktopObjectMap;
  label: string;
};
const POSITION_STORAGE_KEY = "nova-desktop-positions";
const SETTINGS_SEARCH_ENTRIES=[
  {key:"settings:theme",sectionId:"theme",label:"主题",detail:"设置 · 个性化",keywords:"明亮 深色 跟随系统"},
  {key:"settings:sound",sectionId:"sound",label:"声音与音量",detail:"设置 · 声音",keywords:"静音 音效 音量"},
  {key:"settings:backup",sectionId:"backup",label:"本地备份与恢复",detail:"设置 · 本地数据",keywords:"导入 导出 存储 数据"},
  {key:"settings:games",sectionId:"backup",label:"清除游戏记录",detail:"设置 · 本地数据",keywords:"存档 战绩 重置"},
];
const readBrowserFile=(file:File,mode:"text"|"data")=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result??""));reader.onerror=()=>reject(reader.error);if(mode==="text")reader.readAsText(file);else reader.readAsDataURL(file)});

export default function DesktopRoot() {
  const [items,setItems]=useState<DesktopItem[]>([]),[positions,setPositions]=useState<Record<string,IconPosition>>({}),[desktopObjects,setDesktopObjects]=useState<DesktopObjectMap>({}),[storageState,setStorageState]=useState<"loading"|"ready"|"error">("loading"),[selectedIds,setSelectedIds]=useState<string[]>([]);
  const [windowManager,dispatchWindow]=useReducer(windowInstanceReducer,undefined,createInitialWindowInstanceManagerState),windowInstances=windowManager.instances,focused=windowManager.focused;
  const [photoSourceId,setPhotoSourceId]=useState<string|null>(null);
  const [clock,setClock]=useState(""),[contextMenu,setContextMenu]=useState<ContextMenuState|null>(null),[taskbarMenu,setTaskbarMenu]=useState<TaskbarMenuState|null>(null),[taskbarPreview,setTaskbarPreview]=useState<WindowAppId|null>(null),[altTab,setAltTab]=useState<AltTabState|null>(null),[startOpen,setStartOpen]=useState(false),[searchQuery,setSearchQuery]=useState(""),[searchIndex,setSearchIndex]=useState(0),[readerSearchBooks,setReaderSearchBooks]=useState<StoredBookSummary[]>([]),[toast,setToast]=useState(""),[taskbarRevealed,setTaskbarRevealed]=useState(false);
  const [startMode,setStartMode]=useState<"launcher"|"search">("launcher");
  const [renameItemId,setRenameItemId]=useState<string|null>(null),[renameValue,setRenameValue]=useState(""),[booting,setBooting]=useState(true),[draggingFiles,setDraggingFiles]=useState(false);
  const [fileClipboard,setFileClipboard]=useState<FileClipboard|null>(null),[pendingFileOperation,setPendingFileOperation]=useState<PendingFileOperation|null>(null),[fileUndo,setFileUndo]=useState<FileUndoAction|null>(null);
  const [launchIntents,setLaunchIntents]=useState<Partial<Record<WindowInstanceId,AppLaunchIntent>>>({}),[systemPanelOpen,setSystemPanelOpen]=useState(false),[notifications,setNotifications]=useState<DesktopNotification[]>([]),[calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [systemMoment,setSystemMoment]=useState<NovaSystemMoment|null>(null);
  const [settings,setSettings]=useState<NovaSettings>(readNovaSettings),[systemDark,setSystemDark]=useState(false);
  const desktopUploadRef=useRef<HTMLInputElement>(null);
  const desktopSyncRef=useRef<ReturnType<typeof createDesktopSyncQueue>|null>(null);
  const altTabTimerRef=useRef<number|null>(null),launchRequestRef=useRef(0),notificationIdRef=useRef(0);
  const mobileSearchGestureRef=useRef<{pointerId:number;origin:{x:number;y:number}}|null>(null);
  const mobileSearchTouchRef=useRef<{x:number;y:number}|null>(null);
  const desktopDragIconRef=useRef<string|null>(null);

  useEffect(()=>{let cancelled=false;const timer=setTimeout(()=>setBooting(false),1450);const load=async()=>{try{const savedItems=await loadDesktopWorkspace();if(cancelled)return;desktopSyncRef.current=createDesktopSyncQueue(savedItems);setItems(savedItems);setStorageState("ready")}catch{if(!cancelled){setStorageState("error");setToast("桌面文件读取失败")}}if(!cancelled){const savedPositions=localStorage.getItem(POSITION_STORAGE_KEY);try{setPositions(savedPositions?JSON.parse(savedPositions):{})}catch{setPositions({})}setDesktopObjects(readDesktopObjects())}};void load();return()=>{cancelled=true;clearTimeout(timer)}},[]);
  useEffect(()=>{if(storageState!=="ready"||!desktopSyncRef.current)return;void desktopSyncRef.current.enqueue(items).catch(()=>setToast("桌面文件保存失败"))},[items,storageState]);
  useEffect(()=>{if(storageState==="ready")localStorage.setItem(POSITION_STORAGE_KEY,JSON.stringify(positions))},[positions,storageState]);
  useEffect(()=>{if(storageState==="ready")saveDesktopObjects(desktopObjects)},[desktopObjects,storageState]);
  useEffect(()=>{if(!startOpen)return;let cancelled=false;void getStoredBookSummaries().then((books)=>{if(!cancelled)setReaderSearchBooks(books)});return()=>{cancelled=true}},[startOpen]);
  useEffect(()=>{const update=()=>setClock(new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()));update();const timer=setInterval(update,30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),1800);return()=>clearTimeout(timer)},[toast]);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)"),update=()=>setSystemDark(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update)},[]);
  useEffect(()=>subscribeNovaSystemMoments((moment)=>setSystemMoment((current)=>replaceSystemMoment(current,moment))),[]);

  const visibleItems=useMemo(()=>visibleDesktopItems(items),[items]);
  const displayedDesktopObjects=useMemo(()=>visibleDesktopObjects(desktopObjects,items),[desktopObjects,items]);
  const desktopObjectIds=useMemo(()=>new Set(displayedDesktopObjects.map((entry)=>entry.object.itemId)),[displayedDesktopObjects]);
  const updateWindow=useCallback((id:WindowInstanceId,patch:WindowInstancePatch)=>dispatchWindow({type:"update",id,patch}),[]);
  const focusWindow=useCallback((id:WindowInstanceId)=>dispatchWindow({type:"focus",id}),[]);
  const focusDesktop=useCallback(()=>dispatchWindow({type:"focus-desktop"}),[]);
  const closeWindowUi=useCallback(()=>{setStartOpen(false);setSystemPanelOpen(false);setContextMenu(null);setTaskbarMenu(null);setTaskbarPreview(null);setTaskbarRevealed(false)},[]);
  const openWindow=useCallback((app:WindowAppId)=>{const recent=instancesForApp(windowManager,app)[0],id=recent?.id??singletonWindowInstanceId(app);dispatchWindow({type:"open",id,app});closeWindowUi();playNovaSound("open");return id},[closeWindowUi,windowManager]);
  const openNewWindow=useCallback((app:WindowAppId)=>{if(isCompactDesktopViewport()||APP_REGISTRY[app].window.instancePolicy!=="multiple")return openWindow(app);const id=createWindowInstanceId(app,crypto.randomUUID());dispatchWindow({type:"open",id,app});closeWindowUi();playNovaSound("open");return id},[closeWindowUi,openWindow]);
  const openResourceWindow=useCallback((app:WindowAppId,target:WindowInstanceTarget)=>{const policy=APP_REGISTRY[app].window.instancePolicy,recent=instancesForApp(windowManager,app)[0],existing=policy==="per-resource"?selectResourceWindowInstance(windowManager,app,target,isCompactDesktopViewport()):recent;if(existing){dispatchWindow({type:"open",id:existing.id,app,target});closeWindowUi();return existing.id}const id=policy==="per-resource"?createWindowInstanceId(app,crypto.randomUUID()):singletonWindowInstanceId(app);dispatchWindow({type:"open",id,app,target});closeWindowUi();playNovaSound("open");return id},[closeWindowUi,windowManager]);
  const retargetWindow=useCallback((id:WindowInstanceId,target?:WindowInstanceTarget)=>{const instance=windowInstances[id];if(!instance)return id;if(target&&APP_REGISTRY[instance.app].window.instancePolicy==="per-resource"){const existing=findResourceWindowInstance(windowManager,instance.app,target);if(existing&&existing.id!==id){dispatchWindow({type:"focus",id:existing.id});return existing.id}}dispatchWindow({type:"retarget",id,target});dispatchWindow({type:"focus",id});return id},[windowInstances,windowManager]);
  const focusAppWindow=useCallback((app:WindowAppId)=>{const instance=instancesForApp(windowManager,app)[0];if(instance)focusWindow(instance.id)},[focusWindow,windowManager]);
  const launchTarget=useCallback((target:AppLaunchTarget)=>{const instanceId=target.app==="explorer"&&target.parentId?openResourceWindow("explorer",{kind:"folder",itemId:target.parentId}):openWindow(target.app);if(target.app==="explorer"&&!target.parentId)retargetWindow(instanceId);setLaunchIntents((current)=>({...current,[instanceId]:createAppLaunchIntent(++launchRequestRef.current,target)}))},[openResourceWindow,openWindow,retargetWindow]);
  const handleLaunchHandled=useCallback((instanceId:WindowInstanceId,requestId:number)=>setLaunchIntents((current)=>current[instanceId]?.requestId===requestId?{...current,[instanceId]:undefined}:current),[]);
  const notifyFile=(message:string,itemId?:string)=>{setToast(message);setNotifications((current)=>appendDesktopNotification(current,{id:++notificationIdRef.current,message,createdAt:Date.now(),itemId}))};
  const dismissWindow=useCallback((app:WindowAppId)=>{const id=singletonWindowInstanceId(app);dispatchWindow({type:"dismiss",id});setLaunchIntents((current)=>current[id]?{...current,[id]:undefined}:current)},[]);
  const closeWindow=useCallback((id:WindowInstanceId)=>{const app=windowInstances[id]?.app;notifyWindowClosing(id);dispatchWindow({type:"close",id});setLaunchIntents((current)=>current[id]?{...current,[id]:undefined}:current);if(app==="photo")setPhotoSourceId(null);setTaskbarMenu(null);setTaskbarPreview(null);setTaskbarRevealed(false);playNovaSound("close")},[windowInstances]);
  const closeAppWindows=useCallback((app:WindowAppId)=>{for(const instance of instancesForApp(windowManager,app))closeWindow(instance.id)},[closeWindow,windowManager]);
  const minimizeWindow=useCallback((id:WindowInstanceId)=>{dispatchWindow({type:"minimize",id});setTaskbarMenu(null);setTaskbarRevealed(false)},[]);
  const toggleMaximizeWindow=useCallback((id:WindowInstanceId)=>{dispatchWindow({type:"toggle-maximize",id});setTaskbarRevealed(false)},[]);
  const snapWindow=useCallback((id:WindowInstanceId,mode:WindowSnapMode)=>dispatchWindow({type:"snap",id,mode}),[]);

  const uniqueName=(base:string,extension="")=>{let index=1,name=`${base}${extension}`;while(visibleItems.some((item)=>item.name===name)){index+=1;name=`${base} ${index}${extension}`}return name};
  const createFolder=(parentId:string|null=null)=>{const item:DesktopItem={id:crypto.randomUUID(),type:"folder",name:uniqueName("新建文件夹"),content:"",parentId,createdAt:Date.now()};rememberFileUndo("新建文件夹");setItems((current)=>[...current,item]);setSelectedIds(parentId?[]:[item.id]);setContextMenu(null);notifyFile(`${item.name} 已创建`,item.id)};
  const createText=(parentId:string|null=null,sourceInstanceId?:WindowInstanceId)=>{const item:DesktopItem={id:crypto.randomUUID(),type:"text",name:uniqueName("未命名",".txt"),content:"",parentId,createdAt:Date.now()};rememberFileUndo("新建文稿");setItems((current)=>[...current,item]);notifyFile(`${item.name} 已创建`,item.id);const target:WindowInstanceTarget={kind:"text",itemId:item.id};if(sourceInstanceId)retargetWindow(sourceInstanceId,target);else openResourceWindow("notes",target)};
  const createReaderExcerpt=({title,content}:{title:string;content:string})=>{const name=uniqueName(title,".txt"),item:DesktopItem={id:crypto.randomUUID(),type:"text",name,content,parentId:null,createdAt:Date.now()};rememberFileUndo("创建阅读摘录");setItems((current)=>[...current,item]);notifyFile(`${name} 已保存到桌面`,item.id);openResourceWindow("notes",{kind:"text",itemId:item.id})};
  const updateItem=(id:string,patch:Partial<DesktopItem>)=>{if("name" in patch||"content" in patch)setFileUndo(null);setItems((current)=>current.map((item)=>item.id===id?{...item,...patch}:item))};
  const openItemWith=(item:DesktopItem,app:FileOpenApp)=>{setSelectedIds([item.id]);updateItem(item.id,{lastOpenedAt:Date.now()});if(app==="notes")openResourceWindow("notes",{kind:"text",itemId:item.id});if(app==="viewer")openResourceWindow("viewer",{kind:"image",itemId:item.id});if(app==="photo"){setPhotoSourceId(item.id);openWindow("photo")}if(app==="explorer")openResourceWindow("explorer",{kind:"folder",itemId:item.id})};
  const openItem=(item:DesktopItem)=>openItemWith(item,defaultFileOpenApp(item.type));
  const openFolderWindow=(item:DesktopItem)=>{if(item.type==="folder"){updateItem(item.id,{lastOpenedAt:Date.now()});openResourceWindow("folder",{kind:"folder",itemId:item.id})}};
  const savePhoto=(name:string,content:string)=>{const dot=name.lastIndexOf("."),base=dot>0?name.slice(0,dot):name,extension=dot>0?name.slice(dot):"";const finalName=items.some((item)=>!item.deletedAt&&item.name===name)?uniqueName(base,extension):name;const item:DesktopItem={id:crypto.randomUUID(),type:"image",name:finalName,content,parentId:null,createdAt:Date.now()};rememberFileUndo("保存图片");setItems((current)=>[...current,item]);notifyFile(`${finalName} 已存储到桌面`,item.id)};
  const savePhotoEdit=(mode:"copy"|"replace",name:string,content:string)=>{if(mode==="replace"&&photoSourceId){const result=replaceDesktopImage(items,photoSourceId,content);if(result.item){if(result.changed){rememberFileUndo("覆盖原图");setItems(result.items);notifyFile(`${result.item.name} 已更新`,result.item.id)}else setToast("原图没有变化");return}}savePhoto(name,content)};
  const downloadItem=(item:DesktopItem)=>{const link=document.createElement("a");let objectUrl="";if(item.type==="image")link.href=item.content;else{objectUrl=URL.createObjectURL(new Blob([item.content],{type:"text/plain;charset=utf-8"}));link.href=objectUrl}link.download=item.name;link.click();if(objectUrl)setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);setContextMenu(null)};
  const closeAffected=(ids:Set<string>)=>{for(const instance of allWindowInstances(windowInstances)){if(instance.target&&ids.has(instance.target.itemId))closeWindow(instance.id)}if(photoSourceId&&ids.has(photoSourceId)){setPhotoSourceId(null);dismissWindow("photo")}};
  const rememberFileUndo=(label:string)=>setFileUndo({items,positions,objects:desktopObjects,label});
  const moveManyToRecycleBin=(ids:string[])=>{const roots=topLevelDesktopItemIds(items,ids);if(!roots.length)return;const affected=descendantIds(items,roots);rememberFileUndo("移到回收站");setItems(trashDesktopItems(items,roots));closeAffected(affected);setSelectedIds([]);setContextMenu(null);focusDesktop();notifyFile(`${roots.length} 个项目已移到回收站`)};
  const setClipboard=(mode:FileOperationMode,ids:string[])=>{const roots=topLevelDesktopItemIds(items,ids);if(!roots.length)return;setFileClipboard({mode,ids:roots});setContextMenu(null);setToast(`${roots.length} 个项目已${mode==="copy"?"复制":"剪切"}`)};
  const performFileOperation=(mode:FileOperationMode,ids:string[],parentId:string|null,strategy:FileConflictStrategy)=>{const result=applyDesktopFileOperation(items,ids,parentId,mode,strategy);if(!result.changed){setToast("无法完成此文件操作");return}rememberFileUndo(mode==="copy"?"复制项目":"移动项目");setItems(result.items);if(result.removedIds.size){setPositions((current)=>Object.fromEntries(Object.entries(current).filter(([id])=>!result.removedIds.has(id))));setDesktopObjects((current)=>removeDesktopObjects(current,result.removedIds));closeAffected(result.removedIds)}setSelectedIds(parentId===null?result.resultIds:[]);if(mode==="move")setFileClipboard(null);setPendingFileOperation(null);setContextMenu(null);notifyFile(`${result.resultIds.length} 个项目已${mode==="copy"?"复制":"移动"}`,result.resultIds.length===1?result.resultIds[0]:undefined)};
  const requestFileOperation=(mode:FileOperationMode,ids:string[],parentId:string|null)=>{const roots=topLevelDesktopItemIds(items,ids);if(!roots.length)return;const rootIds=new Set(roots),conflicts=desktopFileOperationConflicts(items,roots,parentId,mode).filter((conflict)=>!rootIds.has(conflict.targetId));if(conflicts.length){setPendingFileOperation({mode,ids:roots,parentId,conflicts});return}performFileOperation(mode,roots,parentId,"keep-both")};
  const pasteClipboard=(parentId:string|null)=>{if(fileClipboard)requestFileOperation(fileClipboard.mode,fileClipboard.ids,parentId)};
  const undoFileOperation=()=>{if(!fileUndo)return;setItems(fileUndo.items);setPositions(fileUndo.positions);setDesktopObjects(fileUndo.objects);setFileUndo(null);setPendingFileOperation(null);setSelectedIds([]);notifyFile(`已撤销：${fileUndo.label}`)};
  const restoreMany=(ids:string[])=>{const result=restoreDesktopItems(items,ids);if(!result.resultIds.length)return;rememberFileUndo("还原项目");setItems(result.items);notifyFile(`${result.resultIds.length} 个项目已还原`,result.resultIds.length===1?result.resultIds[0]:undefined)};
  const permanentlyDeleteMany=(ids:string[])=>{const result=permanentlyDeleteDesktopItems(items,ids);setFileUndo(null);setItems(result.items);setPositions((current)=>Object.fromEntries(Object.entries(current).filter(([id])=>!result.removedIds.has(id))));setDesktopObjects((current)=>removeDesktopObjects(current,result.removedIds));closeAffected(result.removedIds);setSelectedIds([]);setContextMenu(null);notifyFile(`${ids.length} 个项目已永久删除`)};
  const emptyRecycleBin=()=>{const result=permanentlyDeleteDesktopItems(items,items.filter((item)=>item.deletedAt).map((item)=>item.id));setFileUndo(null);setItems(result.items);setPositions((current)=>Object.fromEntries(Object.entries(current).filter(([id])=>!result.removedIds.has(id))));setDesktopObjects((current)=>removeDesktopObjects(current,result.removedIds));closeAffected(result.removedIds);notifyFile("回收站已清空")};
  const noteItems=visibleItems.filter((item)=>item.type==="text").sort((a,b)=>b.createdAt-a.createdAt);
  const photoSourceItem=visibleItems.find((item)=>item.id===photoSourceId&&item.type==="image")??null;
  const photoEditorSource=useMemo<WorkspacePhotoSource|null>(()=>photoSourceItem?{id:photoSourceItem.id,name:photoSourceItem.name.replace(/\.[^.]+$/,"")||"照片",content:photoSourceItem.content}:null,[photoSourceItem?.content,photoSourceItem?.id,photoSourceItem?.name]);
  const launchApp=(app:WindowAppId)=>{if(app==="notes"&&!instancesForApp(windowManager,"notes").length&&noteItems[0]){openResourceWindow("notes",{kind:"text",itemId:noteItems[0].id});return}openWindow(app)};
  const removeNote=(id:string)=>{rememberFileUndo("删除文稿");setItems((current)=>trashDesktopItems(current,[id]));closeAffected(new Set([id]));notifyFile("文稿已移到回收站")};
  const contextItem=contextMenu?.itemId?visibleItems.find((item)=>item.id===contextMenu.itemId)??null:null;
  const rootItems=visibleItems.filter((item)=>item.parentId===null);
  const desktopIconItems=rootItems.filter((item)=>!desktopObjectIds.has(item.id));
  const trashedItems=recycleBinItems(items);
  const appEntries=LAUNCHER_APPS.map((app)=>({...app,key:app.id,icon:app.id==="recycle"&&trashedItems.length?"▨":app.icon,open:()=>launchApp(app.id)}));
  const contextApp=contextMenu?.appKey?appEntries.find((app)=>app.key===contextMenu.appKey)??null:null;
  const contextTargets=contextItem?(selectedIds.includes(contextItem.id)?visibleItems.filter((item)=>selectedIds.includes(item.id)):[contextItem]):[];
  const searchText=searchQuery.trim().toLowerCase(),searchApps=searchText?appEntries.filter((app)=>`${app.label} ${app.kind}`.toLowerCase().includes(searchText)):[],searchItems=searchText?visibleItems.filter((item)=>item.name.toLowerCase().includes(searchText)||(item.type==="text"&&item.content.toLowerCase().includes(searchText))):[],searchBooks=searchText?readerSearchBooks.filter((book)=>`${book.title} ${book.author}`.toLowerCase().includes(searchText)):[],searchSettings=searchText?SETTINGS_SEARCH_ENTRIES.filter((entry)=>`${entry.label} ${entry.detail} ${entry.keywords}`.toLowerCase().includes(searchText)):[];
  const searchSystem=searchText&&"日期与通知 日历 通知 文件活动".includes(searchText)?[{key:"system:notifications",label:"日期与通知",icon:"◷",detail:"系统面板",open:()=>{focusDesktop();setSystemPanelOpen(true)}}]:[];
  const searchResults=[...searchApps.map((app)=>({key:`app:${app.key}`,label:app.label,icon:app.icon,detail:"应用",open:app.open})),...searchItems.map((item)=>({key:item.id,label:item.name,icon:item.type==="folder"?"▱":item.type==="image"?"▧":"TXT",detail:`${item.type==="folder"?"文件夹":item.type==="image"?"照片":"文本文稿"} · 打开所在位置`,open:()=>launchTarget({app:"explorer",kind:"file",itemId:item.id,parentId:item.parentId})})),...searchBooks.map((book)=>({key:`book:${book.id}`,label:book.title,icon:"阅",detail:`书籍 · ${book.author}`,open:()=>launchTarget({app:"reader",kind:"book",bookId:book.id})})),...searchSettings.map((entry)=>({key:entry.key,label:entry.label,icon:"⚙",detail:entry.detail,open:()=>launchTarget({app:"settings",kind:"section",sectionId:entry.sectionId})})),...searchSystem];
  const closeStartMenu=()=>{setStartOpen(false);setSearchQuery("");setSearchIndex(0);setStartMode("launcher")};
  const runSearchResult=(index:number)=>{const result=searchResults[index];if(!result)return;result.open();closeStartMenu()};
  const windowProps=(instance:WindowInstance)=>({instance,minimized:instance.minimized,maximized:instance.maximized,snapMode:instance.snapMode,focused:focused===instance.id,zIndex:20+instance.z,taskbarPreviewing:instance.minimized&&taskbarPreview===instance.app,onFocus:()=>focusWindow(instance.id),onClose:()=>closeWindow(instance.id),onMinimize:()=>minimizeWindow(instance.id),onMaximize:()=>toggleMaximizeWindow(instance.id),onSnap:(mode:WindowSnapMode)=>snapWindow(instance.id,mode),onUnsnap:()=>updateWindow(instance.id,{snapMode:undefined})});
  const taskbarApps=REGISTERED_APPS.filter((app)=>app.taskbarPinned||instancesForApp(windowManager,app.id).length);
  const taskbarLabel=(app:AppDefinition)=>{const running=instancesForApp(windowManager,app.id);return running.length===1?running[0].taskbarTitle??app.label:app.label};
  const focusedWindowState=focused==="desktop"?null:windowInstances[focused];
  const focusedApp=focusedWindowState?.app;
  const focusedNote=focusedWindowState?.target?.kind==="text"?visibleItems.find((item)=>item.id===focusedWindowState.target?.itemId&&item.type==="text")??null:null;
  const taskbarAutoHide=!!focusedWindowState&&!focusedWindowState.minimized&&focusedWindowState.maximized;
  const mobileWindowOpen=allWindowInstances(windowInstances).some((instance)=>!instance.minimized);
  const taskbarMenuApp=taskbarMenu?APP_REGISTRY[taskbarMenu.app]:null;
  const darkTheme=settings.theme==="dark"||(settings.theme==="system"&&systemDark);
  const calendarGrid=calendarDays(calendarMonth.getFullYear(),calendarMonth.getMonth());
  const calendarTitle=new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long"}).format(calendarMonth);
  const updateSettings=useCallback((next:NovaSettings)=>{setSettings(next);saveNovaSettings(next)},[]);
  const clearMoment=useCallback((id:string)=>setSystemMoment((current)=>clearSystemMoment(current,id)),[]);
  const setWindowTitle=useCallback((id:WindowInstanceId,title?:string,taskbar=false)=>updateWindow(id,{title,...(taskbar?{taskbarTitle:title}:{})}),[updateWindow]);
  const windowRuntime=useMemo(()=>({instances:windowInstances,focused,openApp:openWindow,openNewWindow,openResource:openResourceWindow,retargetInstance:retargetWindow,focusInstance:focusWindow,closeInstance:closeWindow,isAppOpen:(app:WindowAppId)=>instancesForApp(windowManager,app).length>0,isAppActive:(app:WindowAppId)=>windowIsActive(windowInstances,focused,app),isInstanceActive:(id:WindowInstanceId)=>focused===id&&!!windowInstances[id]&&!windowInstances[id].minimized,setWindowTitle}),[closeWindow,focusWindow,focused,openNewWindow,openResourceWindow,openWindow,retargetWindow,setWindowTitle,windowInstances,windowManager]);
  const launchRuntime=useMemo<LaunchRuntimeValue>(()=>({intents:launchIntents,markHandled:handleLaunchHandled}),[handleLaunchHandled,launchIntents]);
  const settingsRuntime=useMemo<SettingsRuntimeValue>(()=>({settings,updateSettings}),[settings,updateSettings]);
  const openMobileSearch=()=>{if(mobileWindowOpen)return;setStartMode("search");setStartOpen(true);setSearchQuery("");setSearchIndex(0);setContextMenu(null);setSystemPanelOpen(false)};
  const beginMobileSearchPull=(event:ReactPointerEvent<HTMLElement>)=>{
    const target=event.target as HTMLElement,desktop=target.closest<HTMLElement>(".desktop-files");
    if(event.pointerType==="touch"||!isCompactDesktopViewport()||mobileWindowOpen||startOpen||!desktop||desktop.scrollTop>0||target.closest(".desktop-item,.desktop-shortcut,.desktop-creative-object,.desktop-menu"))return;
    mobileSearchGestureRef.current={pointerId:event.pointerId,origin:{x:event.clientX,y:event.clientY}};
  };
  const updateMobileSearchPull=(event:ReactPointerEvent<HTMLElement>)=>{
    const gesture=mobileSearchGestureRef.current;
    if(!gesture||gesture.pointerId!==event.pointerId||!isMobileSearchPull(gesture.origin,{x:event.clientX,y:event.clientY}))return;
    mobileSearchGestureRef.current=null;
    openMobileSearch();
  };
  const endMobileSearchPull=(event:ReactPointerEvent<HTMLElement>)=>{
    if(mobileSearchGestureRef.current?.pointerId!==event.pointerId)return;
    mobileSearchGestureRef.current=null;
  };
  const beginMobileSearchTouch=(event:ReactTouchEvent<HTMLElement>)=>{
    const target=event.target as HTMLElement,desktop=target.closest<HTMLElement>(".desktop-files"),touch=event.touches[0];
    if(event.touches.length!==1||!touch||!isCompactDesktopViewport()||mobileWindowOpen||startOpen||!desktop||desktop.scrollTop>0)return;
    mobileSearchTouchRef.current={x:touch.clientX,y:touch.clientY};
  };
  const updateMobileSearchTouch=(event:ReactTouchEvent<HTMLElement>)=>{
    const origin=mobileSearchTouchRef.current,touch=event.touches[0];
    if(event.touches.length!==1){mobileSearchTouchRef.current=null;return}
    if(!origin||!touch||!isMobileSearchPull(origin,{x:touch.clientX,y:touch.clientY}))return;
    event.preventDefault();
    mobileSearchTouchRef.current=null;
    openMobileSearch();
  };
  const endMobileSearchTouch=()=>{mobileSearchTouchRef.current=null};
  const defaultPosition=(index:number):IconPosition=>({x:Math.floor(index/7)*89,y:index%7*90});
  const desktopEntryIds=[...appEntries.map((app)=>`app:${app.key}`),...desktopIconItems.map((item)=>item.id)];
  const resolvePositions=(source:Record<string,IconPosition>)=>desktopEntryIds.reduce<Record<string,IconPosition>>((result,id)=>{
    const overlaps=(candidate:IconPosition)=>Object.values(result).some((position)=>Math.abs(position.x-candidate.x)<78&&Math.abs(position.y-candidate.y)<86);
    if(source[id]&&!overlaps(source[id])){result[id]=source[id];return result}
    let slot=0;
    while(overlaps(defaultPosition(slot)))slot++;
    result[id]=defaultPosition(slot);
    return result;
  },{});
  const resolvedPositions=resolvePositions(positions);
  const orderedDesktopEntryIds=[...desktopEntryIds].sort((left,right)=>resolvedPositions[left].x-resolvedPositions[right].x||resolvedPositions[left].y-resolvedPositions[right].y);
  const desktopEntryOrder=new Map(orderedDesktopEntryIds.map((id,index)=>[id,index]));
  const positionFor=(id:string,index:number)=>resolvedPositions[id]??defaultPosition(index);
  const reorderIcon=(sourceId:string,targetId:string)=>setPositions((current)=>{
    const resolved=resolvePositions(current);
    const ordered=[...desktopEntryIds].sort((left,right)=>resolved[left].x-resolved[right].x||resolved[left].y-resolved[right].y);
    const next=reorderDesktopIconIds(ordered,sourceId,targetId);
    if(next===ordered)return current;
    return{...current,...Object.fromEntries(next.map((id,index)=>[id,defaultPosition(index)]))};
  });
  const moveIcon=(id:string,position:IconPosition)=>{
    if(isCompactDesktopViewport()){
      const column=Math.max(0,Math.min(2,Math.floor(position.x/Math.max(1,(window.innerWidth-24)/3))));
      const row=Math.max(0,Math.floor(position.y/120));
      const targetId=orderedDesktopEntryIds[Math.min(orderedDesktopEntryIds.length-1,row*3+column)];
      if(targetId)reorderIcon(id,targetId);
      return;
    }
    const targetId=orderedDesktopEntryIds.reduce((closest,candidate)=>{
      const candidatePosition=resolvedPositions[candidate],closestPosition=resolvedPositions[closest];
      return Math.hypot(candidatePosition.x-position.x,candidatePosition.y-position.y)<Math.hypot(closestPosition.x-position.x,closestPosition.y-position.y)?candidate:closest;
    },orderedDesktopEntryIds[0]);
    if(targetId)reorderIcon(id,targetId);
  };
  const displayAsDesktopObject=(item:DesktopItem)=>{
    const sourcePosition=resolvedPositions[item.id]??{x:100,y:80};
    const position={
      x:Math.max(0,Math.min(sourcePosition.x,window.innerWidth-208)),
      y:Math.max(0,Math.min(sourcePosition.y,window.innerHeight-252)),
    };
    setPositions((current)=>({...current,...resolvedPositions}));
    setDesktopObjects((current)=>createDesktopObject(current,item,position));
    setSelectedIds([item.id]);
    setContextMenu(null);
    setToast(item.type==="image"?"已显示为照片卡片":"已显示为文字便笺");
  };
  const restoreDesktopObject=(item:DesktopItem)=>{
    setDesktopObjects((current)=>removeDesktopObjects(current,[item.id]));
    setSelectedIds(item.parentId===null?[item.id]:[]);
    setContextMenu(null);
    setToast("已恢复为文件图标");
  };
  const importFiles=async(fileList:FileList|File[])=>{const files=Array.from(fileList),accepted=files.filter((file)=>file.type.startsWith("image/")||file.type==="text/plain"||file.name.toLowerCase().endsWith(".txt"));if(!accepted.length){setToast("暂时只支持图片和 TXT 文件");setDraggingFiles(false);return}const records=await Promise.all(accepted.map(async(file)=>({type:(file.type.startsWith("image/")?"image":"text") as DesktopItem["type"],name:file.name,content:await readBrowserFile(file,file.type.startsWith("image/")?"data":"text")})));rememberFileUndo("导入文件");setItems((current)=>{const next=[...current];for(const record of records){const dot=record.name.lastIndexOf("."),base=dot>0?record.name.slice(0,dot):record.name,extension=dot>0?record.name.slice(dot):"";let name=record.name,index=2;while(next.some((item)=>!item.deletedAt&&item.name===name)){name=`${base} ${index}${extension}`;index++}next.push({id:crypto.randomUUID(),type:record.type,name,content:record.content,parentId:null,createdAt:Date.now()})}return next});setDraggingFiles(false);notifyFile(`${records.length} 个文件已上传到桌面`)};
  const selectItem=(id:string,event:ReactMouseEvent)=>{focusDesktop();if(event.ctrlKey||event.metaKey||event.shiftKey)setSelectedIds((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);else setSelectedIds([id])};
  const openItemMenu=(item:DesktopItem,x:number,y:number)=>{if(!selectedIds.includes(item.id))setSelectedIds([item.id]);setContextMenu({x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-350),itemId:item.id});setStartOpen(false)};
  const beginRename=(item:DesktopItem)=>{setRenameItemId(item.id);setRenameValue(item.name);setContextMenu(null)};
  const finishRename=()=>{const name=renameValue.trim(),source=renameItemId?items.find((item)=>item.id===renameItemId):null;if(source&&name&&name!==source.name){rememberFileUndo("重命名项目");setItems(items.map((item)=>item.id===source.id?{...item,name}:item));notifyFile(`${source.name} 已重命名为 ${name}`,source.id)}setRenameItemId(null)};
  const arrangeIcons=(mode:"name"|"type"|"clean")=>{const entries=[...appEntries.map((app)=>({id:`app:${app.key}`,label:app.label,type:"app"})),...desktopIconItems.map((item)=>({id:item.id,label:item.name,type:item.type}))];if(mode==="name")entries.sort((a,b)=>a.label.localeCompare(b.label,"zh-CN"));if(mode==="type")entries.sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label,"zh-CN"));const rows=Math.max(1,Math.floor((window.innerHeight-78)/90));setPositions((current)=>({...current,...Object.fromEntries(entries.map((entry,index)=>[entry.id,{x:Math.floor(index/rows)*89,y:index%rows*90}]))}));setContextMenu(null);setToast(mode==="clean"?"桌面图标已整理":mode==="name"?"已按名称排序":"已按类型排序")};
  const activateFromTaskbar=(app:WindowAppId)=>{const state=focused==="desktop"?undefined:windowInstances[focused];if(state?.app===app&&!state.minimized){minimizeWindow(state.id);return}openWindow(app)};
  const cycleWindows=useCallback((reverse=false)=>{const ordered=allWindowInstances(windowInstances).sort((a,b)=>b.z-a.z).map((instance)=>instance.id);if(!ordered.length)return;const instances=altTab?.instances.filter((id)=>windowInstances[id])??ordered,index=instances.indexOf(altTab?.active??(focused==="desktop"?instances[0]:focused)),next=instances[(index+(reverse?-1:1)+instances.length)%instances.length];focusWindow(next);setAltTab({instances,active:next});if(altTabTimerRef.current)window.clearTimeout(altTabTimerRef.current);altTabTimerRef.current=window.setTimeout(()=>setAltTab(null),900)},[altTab,focusWindow,focused,windowInstances]);
  const workspaceRuntime:WorkspaceRuntimeValue={
    items,
    visibleItems,
    clipboard:fileClipboard,
    canUndo:!!fileUndo,
    photoEditorSource,
    trashedItems,
    createText,
    createFolder,
    updateItem,
    removeNote,
    openItem,
    openItemWith,
    openFolderWindow,
    editImage:(item)=>openItemWith(item,"photo"),
    renameItem:beginRename,
    setClipboard,
    paste:pasteClipboard,
    performFileOperation:requestFileOperation,
    trashFromExplorer:(ids)=>{moveManyToRecycleBin(ids);focusAppWindow("explorer")},
    undoFileOperation,
    openRecycleBin:()=>openWindow("recycle"),
    openItemMenu,
    restoreItems:restoreMany,
    permanentlyDeleteItems:permanentlyDeleteMany,
    emptyRecycleBin,
    savePhoto,
    savePhotoEdit,
    createReaderExcerpt,
  };
  useEffect(()=>()=>{if(altTabTimerRef.current)window.clearTimeout(altTabTimerRef.current)},[]);

  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      const command=event.ctrlKey||event.metaKey,key=event.key.toLowerCase(),target=event.target as HTMLElement,typing=target.matches("input,textarea,[contenteditable=true]");
      if(event.ctrlKey&&event.code==="Space"){event.preventDefault();setStartMode("launcher");setStartOpen((current)=>!current);setSearchQuery("");setSearchIndex(0);return}
      if(event.altKey&&event.key==="Tab"){event.preventDefault();cycleWindows(event.shiftKey);return}
      if(event.metaKey&&focused!=="desktop"&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){const state=windowInstances[focused];if(!state)return;event.preventDefault();const action=windowShortcutAction(state.snapMode,state.maximized,event.key as "ArrowLeft"|"ArrowRight"|"ArrowUp"|"ArrowDown");if(action==="maximize")updateWindow(focused,{maximized:true,snapMode:undefined});else if(action==="restore")updateWindow(focused,{maximized:false,snapMode:undefined});else if(action==="minimize")minimizeWindow(focused);else snapWindow(focused,action);return}
      if(command&&key==="w"){event.preventDefault();if(focused!=="desktop")closeWindow(focused);setContextMenu(null);setStartOpen(false);setSearchQuery("");return}
      if(command&&key==="n"&&focusedApp==="explorer"&&!isCompactDesktopViewport()){event.preventDefault();openNewWindow("explorer");return}
      if(typing&&!(focusedApp==="notes"&&command&&(key==="s"||key==="n")))return;
      if(command&&key==="c"&&focused==="desktop"&&selectedIds.length){event.preventDefault();setClipboard("copy",selectedIds);return}
      if(command&&key==="x"&&focused==="desktop"&&selectedIds.length){event.preventDefault();setClipboard("move",selectedIds);return}
      if(command&&key==="v"&&focused==="desktop"&&fileClipboard){event.preventDefault();pasteClipboard(null);return}
      if(command&&key==="z"&&focused==="desktop"&&fileUndo){event.preventDefault();undoFileOperation();return}
      if(command&&key==="s"&&focusedApp==="notes"&&focusedNote){event.preventDefault();setToast(`${focusedNote.name} 已保存到桌面`);return}
      if(command&&key==="n"&&focusedApp==="notes"&&focused!=="desktop"){event.preventDefault();createText(null,focused);return}
      if(command&&key==="a"&&focused==="desktop"){event.preventDefault();setSelectedIds([...desktopIconItems.map((item)=>item.id),...displayedDesktopObjects.map((entry)=>entry.item.id)]);return}
      if(event.shiftKey&&event.key==="F10"&&focused==="desktop"&&!selectedIds.length){event.preventDefault();setContextMenu({x:48,y:48});setStartOpen(false);return}
      if(event.key==="F2"&&focused==="desktop"&&selectedIds.length===1){const item=items.find((entry)=>entry.id===selectedIds[0]);if(item){event.preventDefault();beginRename(item)}return}
      if(event.key==="Delete"&&focused==="desktop"&&selectedIds.length){event.preventDefault();moveManyToRecycleBin(selectedIds);return}
      if(event.altKey&&event.key==="F4"){event.preventDefault();if(focused!=="desktop")closeWindow(focused);return}
      if(event.key==="Escape"&&(contextMenu||taskbarMenu||startOpen||pendingFileOperation||systemPanelOpen)){event.preventDefault();setContextMenu(null);setTaskbarMenu(null);setStartOpen(false);setPendingFileOperation(null);setSystemPanelOpen(false);setSearchQuery("")}
    };
    window.addEventListener("keydown",shortcut);
    return()=>window.removeEventListener("keydown",shortcut)
  },[closeWindow,contextMenu,cycleWindows,desktopIconItems,displayedDesktopObjects,fileClipboard,fileUndo,focused,focusedApp,focusedNote,items,minimizeWindow,openNewWindow,pendingFileOperation,selectedIds,snapWindow,startOpen,systemPanelOpen,taskbarMenu,updateWindow,windowInstances]);
  return <WindowRuntimeProvider value={windowRuntime}><LaunchRuntimeProvider value={launchRuntime}><SettingsRuntimeProvider value={settingsRuntime}><WorkspaceRuntimeProvider value={workspaceRuntime}><main className={`super-desktop windows-desktop wallpaper-${settings.wallpaper} ${darkTheme?"theme-dark":"theme-light"} ${taskbarAutoHide?"taskbar-auto-hide":""} ${taskbarRevealed?"taskbar-revealed":""} ${mobileWindowOpen?"mobile-window-open":""} ${startOpen?"start-menu-open":""} ${systemPanelOpen?"system-panel-open":""}`} onPointerMove={(event)=>{updateMobileSearchPull(event);if(!taskbarAutoHide)return;const target=event.target as HTMLElement,reveal=event.clientY>=event.currentTarget.clientHeight-10||!!target.closest(".windows-taskbar,.start-menu,.taskbar-window-menu,.system-panel");if(reveal!==taskbarRevealed)setTaskbarRevealed(reveal)}} onPointerDown={(event)=>{beginMobileSearchPull(event);const target=event.target as HTMLElement;if(!target.closest(".desktop-item,.desktop-shortcut,.desktop-creative-object,.rename-dialog,.file-operation-dialog"))setSelectedIds([]);if(!target.closest(".desktop-menu"))setContextMenu(null);if(!target.closest(".taskbar-window-menu,.taskbar-entry"))setTaskbarMenu(null);if(!target.closest(".taskbar-entry"))setTaskbarPreview(null);if(!target.closest(".system-panel,.taskbar-clock"))setSystemPanelOpen(false);if(!target.closest(".start-menu,.start-button")){setStartOpen(false);setSearchQuery("")}}} onPointerUp={endMobileSearchPull} onPointerCancel={endMobileSearchPull} onTouchStart={beginMobileSearchTouch} onTouchMove={updateMobileSearchTouch} onTouchEnd={endMobileSearchTouch} onTouchCancel={endMobileSearchTouch} onContextMenu={(event)=>{if((event.target as HTMLElement).closest(".desktop-window,.windows-taskbar,.desktop-item,.desktop-shortcut,.desktop-creative-object"))return;event.preventDefault();setContextMenu({x:Math.min(event.clientX,window.innerWidth-225),y:Math.min(event.clientY,window.innerHeight-250)});focusDesktop();setStartOpen(false)}} onDragOver={(event)=>{if((event.target as HTMLElement).closest(".desktop-window"))return;const internal=hasDesktopFileDrag(event.dataTransfer);event.preventDefault();event.dataTransfer.dropEffect=internal?desktopFileDragMode(event):"copy";setDraggingFiles(!internal)}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDraggingFiles(false)}} onDrop={(event)=>{if((event.target as HTMLElement).closest(".desktop-window"))return;event.preventDefault();setDraggingFiles(false);desktopDragIconRef.current=null;const ids=readDesktopFileDragIds(event.dataTransfer);if(ids.length){const mode=desktopFileDragMode(event),alreadyOnDesktop=ids.every((id)=>items.find((item)=>item.id===id)?.parentId===null);if(!alreadyOnDesktop||mode==="copy")requestFileOperation(mode,ids,null)}else void importFiles(event.dataTransfer.files)}}>
    <input ref={desktopUploadRef} className="desktop-upload-input" aria-label="上传桌面文件" type="file" accept="image/*,.txt,text/plain" multiple onChange={(event)=>{if(event.target.files?.length)importFiles(event.target.files);event.target.value=""}}/>
    <div className="windows-wallpaper"><i/><i/><i/></div>
    <section className="desktop-files" aria-label="桌面图标">
      {appEntries.map((app,index)=><DesktopShortcut key={app.key} id={`app:${app.key}`} label={app.label} icon={app.icon} kind={app.kind} position={positionFor(`app:${app.key}`,index)} order={desktopEntryOrder.get(`app:${app.key}`)??index} move={moveIcon} open={app.open} onIconDragEnter={(targetId)=>{const sourceId=desktopDragIconRef.current;if(sourceId)reorderIcon(sourceId,targetId)}} onContextMenu={(x,y)=>{setContextMenu({x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-100),appKey:app.key});setStartOpen(false)}}/>)}
      {desktopIconItems.map((item,index)=><DesktopFile key={item.id} item={item} position={positionFor(item.id,appEntries.length+index)} order={desktopEntryOrder.get(item.id)??appEntries.length+index} move={moveIcon} selected={selectedIds.includes(item.id)} cut={fileClipboard?.mode==="move"&&fileClipboard.ids.includes(item.id)} onSelect={(event)=>selectItem(item.id,event)} onOpen={()=>openItem(item)} onDragStart={(event)=>{desktopDragIconRef.current=item.id;const ids=selectedIds.includes(item.id)?selectedIds:[item.id];if(!selectedIds.includes(item.id))setSelectedIds(ids);writeDesktopFileDragIds(event.dataTransfer,ids)}} onDragEnd={()=>{desktopDragIconRef.current=null}} onIconDragEnter={(targetId)=>{const sourceId=desktopDragIconRef.current;if(sourceId)reorderIcon(sourceId,targetId)}} onFileDrop={item.type==="folder"?(event)=>{desktopDragIconRef.current=null;const ids=readDesktopFileDragIds(event.dataTransfer);if(!ids.length)return;event.preventDefault();event.stopPropagation();requestFileOperation(desktopFileDragMode(event),ids,item.id)}:undefined} onContextMenu={(x,y)=>openItemMenu(item,x,y)}/>)}
      <DesktopCreativeObjects entries={displayedDesktopObjects} selectedIds={selectedIds} onSelect={selectItem} onOpen={(itemId)=>{const item=visibleItems.find((entry)=>entry.id===itemId);if(item)openItem(item)}} onMove={(itemId,position)=>setDesktopObjects((current)=>moveDesktopObject(current,itemId,position))} onContextMenu={(itemId,x,y)=>{const item=visibleItems.find((entry)=>entry.id===itemId);if(item)openItemMenu(item,x,y)}}/>
    </section>
    {contextMenu&&<div className="desktop-menu" style={{left:contextMenu.x,top:contextMenu.y}}>{contextApp?<><button onClick={contextApp.open}>打开 {contextApp.label}</button>{APP_REGISTRY[contextApp.key].window.instancePolicy==="multiple"&&<button className="desktop-new-window-command" onClick={()=>openNewWindow(contextApp.key)}>新建窗口</button>}</>:contextItem?<>{contextTargets.length===1?<><button onClick={()=>openItem(contextItem)}>打开</button>{desktopObjectIds.has(contextItem.id)?<button onClick={()=>restoreDesktopObject(contextItem)}>恢复为文件图标</button>:contextItem.parentId===null&&contextItem.type==="image"?<button onClick={()=>displayAsDesktopObject(contextItem)}>显示为照片卡片</button>:contextItem.parentId===null&&contextItem.type==="text"?<button onClick={()=>displayAsDesktopObject(contextItem)}>显示为文字便笺</button>:null}{contextItem.type==="folder"&&<button className="desktop-new-window-command" onClick={()=>openFolderWindow(contextItem)}>在新窗口中打开</button>}{fileOpenOptions(contextItem.type).filter((option)=>!option.primary).map((option)=><button key={option.app} onClick={()=>openItemWith(contextItem,option.app)}>使用{option.label}打开</button>)}<button onClick={()=>beginRename(contextItem)}>重命名</button>{contextItem.type==="folder"&&<><button onClick={()=>createFolder(contextItem.id)}>在文件夹中新建文件夹</button><button onClick={()=>createText(contextItem.id)}>在文件夹中新建文本</button>{fileClipboard&&<button onClick={()=>pasteClipboard(contextItem.id)}>粘贴到此文件夹</button>}</>}{contextItem.type!=="folder"&&<button onClick={()=>downloadItem(contextItem)}>保存到下载</button>}<span/></>:<p className="menu-summary">已选择 {contextTargets.length} 个项目</p>}<button onClick={()=>setClipboard("move",contextTargets.map((item)=>item.id))}>剪切</button><button onClick={()=>setClipboard("copy",contextTargets.map((item)=>item.id))}>复制</button><button className="danger" onClick={()=>moveManyToRecycleBin(contextTargets.map((item)=>item.id))}>移到回收站</button><button className="danger" onClick={()=>permanentlyDeleteMany(contextTargets.map((item)=>item.id))}>直接删除</button></>:<><button onClick={()=>createFolder()}>新建文件夹</button><button onClick={()=>createText()}>新建文本文稿</button>{fileClipboard&&<button onClick={()=>pasteClipboard(null)}>粘贴</button>}<button onClick={()=>{desktopUploadRef.current?.click();setContextMenu(null)}}>上传图片或 TXT</button>{fileUndo&&<button onClick={undoFileOperation}>撤销“{fileUndo.label}”</button>}<span/><button onClick={()=>arrangeIcons("name")}>按名称排序</button><button onClick={()=>arrangeIcons("type")}>按类型排序</button><button onClick={()=>arrangeIcons("clean")}>整理图标</button></>}</div>}
    {allWindowInstances(windowInstances).map((instance)=><AppHost key={instance.id} {...windowProps(instance)}/>)}
    {systemMoment&&<DesktopMomentLayer moment={systemMoment} onComplete={clearMoment}/>}
    {altTab&&<section className="window-switcher" role="dialog" aria-label="切换窗口">{altTab.instances.map((id)=>{const instance=windowInstances[id];if(!instance)return null;const definition=APP_REGISTRY[instance.app];return <div key={id} className={altTab.active===id?"active":""}><span className={`app-glyph ${instance.app}-glyph`}>{definition.windowIcon??definition.icon}</span><strong>{instance.taskbarTitle??instance.title??definition.label}</strong></div>})}</section>}
    {startOpen&&<button className="start-menu-scrim" type="button" aria-label={startMode==="search"?"关闭搜索":"关闭开始菜单"} onClick={closeStartMenu}/>}
    {startOpen&&<StartMenu mode={startMode} apps={appEntries} searchQuery={searchQuery} searchIndex={searchIndex} searchResults={searchResults} onSearchQueryChange={setSearchQuery} onSearchIndexChange={setSearchIndex} onRunSearchResult={runSearchResult} onClose={closeStartMenu}/>}
    {systemPanelOpen&&<DesktopSystemPanel calendarTitle={calendarTitle} calendarGrid={calendarGrid} notifications={notifications} visibleItems={visibleItems} onPreviousMonth={()=>setCalendarMonth((current)=>new Date(current.getFullYear(),current.getMonth()-1,1))} onCurrentMonth={()=>setCalendarMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))} onNextMonth={()=>setCalendarMonth((current)=>new Date(current.getFullYear(),current.getMonth()+1,1))} onClearNotifications={()=>setNotifications([])} onLocateItem={(target)=>launchTarget({app:"explorer",kind:"file",itemId:target.id,parentId:target.parentId})}/>}
    <DesktopTaskbar apps={taskbarApps} instances={windowInstances} focused={focused} clock={clock} notificationCount={notifications.length} startOpen={startOpen} previewApp={taskbarPreview} menu={taskbarMenu} menuApp={taskbarMenuApp} labelFor={taskbarLabel} onPreviewChange={setTaskbarPreview} onMenuChange={setTaskbarMenu} onRevealChange={setTaskbarRevealed} onToggleStart={()=>{setTaskbarPreview(null);setStartMode("launcher");setStartOpen(!startOpen);setSystemPanelOpen(false);setSearchQuery("");setSearchIndex(0);setContextMenu(null);setTaskbarMenu(null)}} onActivate={activateFromTaskbar} onActivateInstance={(id)=>{focusWindow(id);setTaskbarMenu(null)}} onOpen={openWindow} onNewWindow={openNewWindow} onMinimize={minimizeWindow} onToggleMaximize={(id)=>{if(windowInstances[id]?.minimized)focusWindow(id);toggleMaximizeWindow(id);setTaskbarMenu(null)}} onClose={closeWindow} onCloseAll={closeAppWindows} onOpenCalendar={()=>openWindow("calendar")} canHide={!startOpen&&!taskbarMenu&&!systemPanelOpen}/>
    <DesktopOverlays renameItemId={renameItemId} renameValue={renameValue} pendingFileOperation={pendingFileOperation} draggingFiles={draggingFiles} toast={toast} booting={booting} onRenameValueChange={setRenameValue} onCancelRename={()=>setRenameItemId(null)} onFinishRename={finishRename} onCancelFileOperation={()=>setPendingFileOperation(null)} onPerformFileOperation={performFileOperation}/>
  </main></WorkspaceRuntimeProvider></SettingsRuntimeProvider></LaunchRuntimeProvider></WindowRuntimeProvider>
}
