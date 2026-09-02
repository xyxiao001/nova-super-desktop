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
  desktopFileOperationConflicts,
  descendantIds,
  NOVA_FILE_DRAG_TYPE,
  permanentlyDeleteDesktopItems,
  recycleBinItems,
  replaceDesktopImage,
  restoreDesktopItems,
  topLevelDesktopItemIds,
  trashDesktopItems,
  visibleDesktopItems,
  type DesktopItem,
  type FileClipboard,
  type FileConflictStrategy,
  type FileOperationMode,
} from "../../app/desktopFiles";
import { createDesktopSyncQueue, loadDesktopWorkspace } from "../../app/desktopStorage";
import {
  appendDesktopNotification,
  calendarDays,
  type DesktopNotification,
} from "../../app/desktopSystem";
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
  createInitialWindowManagerState,
  windowReducer,
  type WindowState,
} from "../platform/windows/windowState";
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
import { DesktopFile, DesktopShortcut, type IconPosition } from "./DesktopIcons";
import DesktopOverlays, { type PendingFileOperation } from "./DesktopOverlays";
import DesktopSystemPanel from "./DesktopSystemPanel";
import DesktopTaskbar, { type TaskbarMenuState } from "./DesktopTaskbar";

type ContextMenuState = { x: number; y: number; itemId?: string; appKey?: WindowAppId };
type AltTabState = { apps:WindowAppId[]; active:WindowAppId };
type FileUndoAction = {
  items: DesktopItem[];
  positions: Record<string, IconPosition>;
  label: string;
};
const POSITION_STORAGE_KEY = "nova-desktop-positions";
const SETTINGS_SEARCH_ENTRIES=[
  {key:"settings:theme",sectionId:"theme",label:"主题",detail:"设置 · 个性化",keywords:"明亮 深色 跟随系统"},
  {key:"settings:sound",sectionId:"sound",label:"声音与音量",detail:"设置 · 声音",keywords:"静音 音效 音量"},
  {key:"settings:backup",sectionId:"backup",label:"本地备份与恢复",detail:"设置 · 本地数据",keywords:"导入 导出 存储 数据"},
  {key:"settings:games",sectionId:"backup",label:"清除游戏记录",detail:"设置 · 本地数据",keywords:"存档 战绩 重置"},
];
const readDesktopDragIds=(dataTransfer:DataTransfer)=>{try{const value=JSON.parse(dataTransfer.getData(NOVA_FILE_DRAG_TYPE));return Array.isArray(value)?value.filter((id):id is string=>typeof id==="string"):[]}catch{return[]}};
const readBrowserFile=(file:File,mode:"text"|"data")=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result??""));reader.onerror=()=>reject(reader.error);if(mode==="text")reader.readAsText(file);else reader.readAsDataURL(file)});

export default function DesktopRoot() {
  const [items,setItems]=useState<DesktopItem[]>([]),[positions,setPositions]=useState<Record<string,IconPosition>>({}),[storageState,setStorageState]=useState<"loading"|"ready"|"error">("loading"),[selectedIds,setSelectedIds]=useState<string[]>([]);
  const [windowManager,dispatchWindow]=useReducer(windowReducer,undefined,createInitialWindowManagerState),windowStates=windowManager.windows,focused=windowManager.focused;
  const [photoSourceId,setPhotoSourceId]=useState<string|null>(null),[activeNoteId,setActiveNoteId]=useState<string|null>(null),[activeImageId,setActiveImageId]=useState<string|null>(null),[activeFolderId,setActiveFolderId]=useState<string|null>(null);
  const [clock,setClock]=useState(""),[contextMenu,setContextMenu]=useState<ContextMenuState|null>(null),[taskbarMenu,setTaskbarMenu]=useState<TaskbarMenuState|null>(null),[taskbarPreview,setTaskbarPreview]=useState<WindowAppId|null>(null),[altTab,setAltTab]=useState<AltTabState|null>(null),[startOpen,setStartOpen]=useState(false),[searchQuery,setSearchQuery]=useState(""),[searchIndex,setSearchIndex]=useState(0),[readerSearchBooks,setReaderSearchBooks]=useState<StoredBookSummary[]>([]),[toast,setToast]=useState(""),[taskbarRevealed,setTaskbarRevealed]=useState(false);
  const [startMode,setStartMode]=useState<"launcher"|"search">("launcher");
  const [renameItemId,setRenameItemId]=useState<string|null>(null),[renameValue,setRenameValue]=useState(""),[booting,setBooting]=useState(true),[draggingFiles,setDraggingFiles]=useState(false);
  const [fileClipboard,setFileClipboard]=useState<FileClipboard|null>(null),[pendingFileOperation,setPendingFileOperation]=useState<PendingFileOperation|null>(null),[fileUndo,setFileUndo]=useState<FileUndoAction|null>(null);
  const [launchIntent,setLaunchIntent]=useState<AppLaunchIntent|null>(null),[systemPanelOpen,setSystemPanelOpen]=useState(false),[notifications,setNotifications]=useState<DesktopNotification[]>([]),[calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [windowTitles,setWindowTitles]=useState<Partial<Record<WindowAppId,string>>>({});
  const [taskbarTitles,setTaskbarTitles]=useState<Partial<Record<WindowAppId,string>>>({});
  const [settings,setSettings]=useState<NovaSettings>(readNovaSettings),[systemDark,setSystemDark]=useState(false);
  const desktopUploadRef=useRef<HTMLInputElement>(null);
  const desktopSyncRef=useRef<ReturnType<typeof createDesktopSyncQueue>|null>(null);
  const altTabTimerRef=useRef<number|null>(null),launchRequestRef=useRef(0),notificationIdRef=useRef(0);
  const mobileSearchGestureRef=useRef<{pointerId:number;origin:{x:number;y:number}}|null>(null);
  const mobileSearchTouchRef=useRef<{x:number;y:number}|null>(null);
  const desktopDragIconRef=useRef<string|null>(null);

  useEffect(()=>{let cancelled=false;const timer=setTimeout(()=>setBooting(false),1450);const load=async()=>{try{const savedItems=await loadDesktopWorkspace();if(cancelled)return;desktopSyncRef.current=createDesktopSyncQueue(savedItems);setItems(savedItems);setStorageState("ready")}catch{if(!cancelled){setStorageState("error");setToast("桌面文件读取失败")}}if(!cancelled){const savedPositions=localStorage.getItem(POSITION_STORAGE_KEY);try{setPositions(savedPositions?JSON.parse(savedPositions):{})}catch{setPositions({})}}};void load();return()=>{cancelled=true;clearTimeout(timer)}},[]);
  useEffect(()=>{if(storageState!=="ready"||!desktopSyncRef.current)return;void desktopSyncRef.current.enqueue(items).catch(()=>setToast("桌面文件保存失败"))},[items,storageState]);
  useEffect(()=>{if(storageState==="ready")localStorage.setItem(POSITION_STORAGE_KEY,JSON.stringify(positions))},[positions,storageState]);
  useEffect(()=>{if(!startOpen)return;let cancelled=false;void getStoredBookSummaries().then((books)=>{if(!cancelled)setReaderSearchBooks(books)});return()=>{cancelled=true}},[startOpen]);
  useEffect(()=>{const update=()=>setClock(new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()));update();const timer=setInterval(update,30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),1800);return()=>clearTimeout(timer)},[toast]);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)"),update=()=>setSystemDark(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update)},[]);

  const visibleItems=useMemo(()=>visibleDesktopItems(items),[items]);
  const updateWindow=useCallback((app:WindowAppId,patch:Partial<WindowState>)=>dispatchWindow({type:"update",app,patch}),[]);
  const focusWindow=useCallback((app:WindowAppId)=>dispatchWindow({type:"focus",app}),[]);
  const focusDesktop=useCallback(()=>dispatchWindow({type:"focus-desktop"}),[]);
  const openWindow=useCallback((app:WindowAppId)=>{dispatchWindow({type:"open",app});setStartOpen(false);setSystemPanelOpen(false);setContextMenu(null);setTaskbarMenu(null);setTaskbarPreview(null);setTaskbarRevealed(false);playNovaSound("open")},[]);
  const launchTarget=useCallback((target:AppLaunchTarget)=>{setLaunchIntent(createAppLaunchIntent(++launchRequestRef.current,target));if(target.app==="explorer")setActiveFolderId(target.parentId);openWindow(target.app)},[openWindow]);
  const handleLaunchHandled=useCallback((requestId:number)=>setLaunchIntent((current)=>current?.requestId===requestId?null:current),[]);
  const notifyFile=(message:string,itemId?:string)=>{setToast(message);setNotifications((current)=>appendDesktopNotification(current,{id:++notificationIdRef.current,message,createdAt:Date.now(),itemId}))};
  const clearWindowTitle=useCallback((app:WindowAppId)=>{setWindowTitles((current)=>({...current,[app]:undefined}));setTaskbarTitles((current)=>({...current,[app]:undefined}))},[]);
  const dismissWindow=useCallback((app:WindowAppId)=>{dispatchWindow({type:"dismiss",app});clearWindowTitle(app)},[clearWindowTitle]);
  const closeWindow=useCallback((app:WindowAppId)=>{notifyWindowClosing(app);dispatchWindow({type:"close",app});clearWindowTitle(app);if(app==="photo")setPhotoSourceId(null);setTaskbarMenu(null);setTaskbarPreview(null);setTaskbarRevealed(false);playNovaSound("close")},[clearWindowTitle]);
  const minimizeWindow=useCallback((app:WindowAppId)=>{dispatchWindow({type:"minimize",app});setTaskbarMenu(null);setTaskbarRevealed(false)},[]);
  const toggleMaximizeWindow=useCallback((app:WindowAppId)=>{dispatchWindow({type:"toggle-maximize",app});setTaskbarRevealed(false)},[]);
  const snapWindow=useCallback((app:WindowAppId,mode:WindowSnapMode)=>dispatchWindow({type:"snap",app,mode}),[]);

  const uniqueName=(base:string,extension="")=>{let index=1,name=`${base}${extension}`;while(visibleItems.some((item)=>item.name===name)){index+=1;name=`${base} ${index}${extension}`}return name};
  const createFolder=(parentId:string|null=null)=>{const item:DesktopItem={id:crypto.randomUUID(),type:"folder",name:uniqueName("新建文件夹"),content:"",parentId,createdAt:Date.now()};rememberFileUndo("新建文件夹");setItems((current)=>[...current,item]);setSelectedIds(parentId?[]:[item.id]);setContextMenu(null);notifyFile(`${item.name} 已创建`,item.id)};
  const createText=(parentId:string|null=null)=>{const item:DesktopItem={id:crypto.randomUUID(),type:"text",name:uniqueName("未命名",".txt"),content:"",parentId,createdAt:Date.now()};rememberFileUndo("新建文稿");setItems((current)=>[...current,item]);setActiveNoteId(item.id);notifyFile(`${item.name} 已创建`,item.id);openWindow("notes")};
  const createReaderExcerpt=({title,content}:{title:string;content:string})=>{const name=uniqueName(title,".txt"),item:DesktopItem={id:crypto.randomUUID(),type:"text",name,content,parentId:null,createdAt:Date.now()};rememberFileUndo("创建阅读摘录");setItems((current)=>[...current,item]);setActiveNoteId(item.id);notifyFile(`${name} 已保存到桌面`,item.id);openWindow("notes")};
  const updateItem=(id:string,patch:Partial<DesktopItem>)=>{if("name" in patch||"content" in patch)setFileUndo(null);setItems((current)=>current.map((item)=>item.id===id?{...item,...patch}:item))};
  const openItemWith=(item:DesktopItem,app:FileOpenApp)=>{setSelectedIds([item.id]);updateItem(item.id,{lastOpenedAt:Date.now()});if(app==="notes"){setActiveNoteId(item.id);openWindow("notes")}if(app==="viewer"){setActiveImageId(item.id);openWindow("viewer")}if(app==="photo"){setPhotoSourceId(item.id);openWindow("photo")}if(app==="explorer"){setActiveFolderId(item.id);openWindow("explorer")}};
  const openItem=(item:DesktopItem)=>openItemWith(item,defaultFileOpenApp(item.type));
  const savePhoto=(name:string,content:string)=>{const dot=name.lastIndexOf("."),base=dot>0?name.slice(0,dot):name,extension=dot>0?name.slice(dot):"";const finalName=items.some((item)=>!item.deletedAt&&item.name===name)?uniqueName(base,extension):name;const item:DesktopItem={id:crypto.randomUUID(),type:"image",name:finalName,content,parentId:null,createdAt:Date.now()};rememberFileUndo("保存图片");setItems((current)=>[...current,item]);notifyFile(`${finalName} 已存储到桌面`,item.id)};
  const savePhotoEdit=(mode:"copy"|"replace",name:string,content:string)=>{if(mode==="replace"&&photoSourceId){const result=replaceDesktopImage(items,photoSourceId,content);if(result.item){if(result.changed){rememberFileUndo("覆盖原图");setItems(result.items);notifyFile(`${result.item.name} 已更新`,result.item.id)}else setToast("原图没有变化");return}}savePhoto(name,content)};
  const downloadItem=(item:DesktopItem)=>{const link=document.createElement("a");let objectUrl="";if(item.type==="image")link.href=item.content;else{objectUrl=URL.createObjectURL(new Blob([item.content],{type:"text/plain;charset=utf-8"}));link.href=objectUrl}link.download=item.name;link.click();if(objectUrl)setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);setContextMenu(null)};
  const closeAffected=(ids:Set<string>)=>{if(activeImageId&&ids.has(activeImageId)){setActiveImageId(null);dismissWindow("viewer")}if(activeNoteId&&ids.has(activeNoteId)){const next=visibleItems.filter((item)=>item.type==="text"&&!ids.has(item.id)).sort((a,b)=>b.createdAt-a.createdAt)[0];setActiveNoteId(next?.id??null)}if(activeFolderId&&ids.has(activeFolderId)){setActiveFolderId(null);dismissWindow("folder")}if(photoSourceId&&ids.has(photoSourceId)){setPhotoSourceId(null);dismissWindow("photo")}};
  const rememberFileUndo=(label:string)=>setFileUndo({items,positions,label});
  const moveManyToRecycleBin=(ids:string[])=>{const roots=topLevelDesktopItemIds(items,ids);if(!roots.length)return;const affected=descendantIds(items,roots);rememberFileUndo("移到回收站");setItems(trashDesktopItems(items,roots));closeAffected(affected);setSelectedIds([]);setContextMenu(null);focusDesktop();notifyFile(`${roots.length} 个项目已移到回收站`)};
  const setClipboard=(mode:FileOperationMode,ids:string[])=>{const roots=topLevelDesktopItemIds(items,ids);if(!roots.length)return;setFileClipboard({mode,ids:roots});setContextMenu(null);setToast(`${roots.length} 个项目已${mode==="copy"?"复制":"剪切"}`)};
  const performFileOperation=(mode:FileOperationMode,ids:string[],parentId:string|null,strategy:FileConflictStrategy)=>{const result=applyDesktopFileOperation(items,ids,parentId,mode,strategy);if(!result.changed){setToast("无法完成此文件操作");return}rememberFileUndo(mode==="copy"?"复制项目":"移动项目");setItems(result.items);if(result.removedIds.size){setPositions((current)=>Object.fromEntries(Object.entries(current).filter(([id])=>!result.removedIds.has(id))));closeAffected(result.removedIds)}setSelectedIds(parentId===null?result.resultIds:[]);if(mode==="move")setFileClipboard(null);setPendingFileOperation(null);setContextMenu(null);notifyFile(`${result.resultIds.length} 个项目已${mode==="copy"?"复制":"移动"}`,result.resultIds.length===1?result.resultIds[0]:undefined)};
  const requestFileOperation=(mode:FileOperationMode,ids:string[],parentId:string|null)=>{const roots=topLevelDesktopItemIds(items,ids);if(!roots.length)return;const rootIds=new Set(roots),conflicts=desktopFileOperationConflicts(items,roots,parentId,mode).filter((conflict)=>!rootIds.has(conflict.targetId));if(conflicts.length){setPendingFileOperation({mode,ids:roots,parentId,conflicts});return}performFileOperation(mode,roots,parentId,"keep-both")};
  const pasteClipboard=(parentId:string|null)=>{if(fileClipboard)requestFileOperation(fileClipboard.mode,fileClipboard.ids,parentId)};
  const undoFileOperation=()=>{if(!fileUndo)return;setItems(fileUndo.items);setPositions(fileUndo.positions);setFileUndo(null);setPendingFileOperation(null);setSelectedIds([]);notifyFile(`已撤销：${fileUndo.label}`)};
  const restoreMany=(ids:string[])=>{const result=restoreDesktopItems(items,ids);if(!result.resultIds.length)return;rememberFileUndo("还原项目");setItems(result.items);notifyFile(`${result.resultIds.length} 个项目已还原`,result.resultIds.length===1?result.resultIds[0]:undefined)};
  const permanentlyDeleteMany=(ids:string[])=>{const result=permanentlyDeleteDesktopItems(items,ids);setFileUndo(null);setItems(result.items);setPositions((current)=>Object.fromEntries(Object.entries(current).filter(([id])=>!result.removedIds.has(id))));closeAffected(result.removedIds);setSelectedIds([]);setContextMenu(null);notifyFile(`${ids.length} 个项目已永久删除`)};
  const emptyRecycleBin=()=>{const result=permanentlyDeleteDesktopItems(items,items.filter((item)=>item.deletedAt).map((item)=>item.id));setFileUndo(null);setItems(result.items);setPositions((current)=>Object.fromEntries(Object.entries(current).filter(([id])=>!result.removedIds.has(id))));closeAffected(result.removedIds);notifyFile("回收站已清空")};
  const activeNote=visibleItems.find((item)=>item.id===activeNoteId&&item.type==="text")??null;
  const noteItems=visibleItems.filter((item)=>item.type==="text").sort((a,b)=>b.createdAt-a.createdAt);
  const activeImage=visibleItems.find((item)=>item.id===activeImageId&&item.type==="image")??null;
  const activeFolder=visibleItems.find((item)=>item.id===activeFolderId&&item.type==="folder")??null;
  const photoSourceItem=visibleItems.find((item)=>item.id===photoSourceId&&item.type==="image")??null;
  const photoEditorSource=useMemo<WorkspacePhotoSource|null>(()=>photoSourceItem?{id:photoSourceItem.id,name:photoSourceItem.name.replace(/\.[^.]+$/,"")||"照片",content:photoSourceItem.content}:null,[photoSourceItem?.content,photoSourceItem?.id,photoSourceItem?.name]);
  const launchApp=(app:WindowAppId)=>{if(app==="notes"){if(!activeNote)setActiveNoteId(noteItems[0]?.id??null);openWindow("notes");return}if(app==="viewer"&&!windowStates.viewer.open)setActiveImageId(null);if(app==="explorer")setActiveFolderId(null);openWindow(app)};
  const removeNote=(id:string)=>{const next=noteItems.find((item)=>item.id!==id);rememberFileUndo("删除文稿");setItems((current)=>trashDesktopItems(current,[id]));setActiveNoteId(next?.id??null);notifyFile("文稿已移到回收站")};
  const contextItem=contextMenu?.itemId?visibleItems.find((item)=>item.id===contextMenu.itemId)??null:null;
  const rootItems=visibleItems.filter((item)=>item.parentId===null);
  const trashedItems=recycleBinItems(items);
  const appEntries=LAUNCHER_APPS.map((app)=>({...app,key:app.id,icon:app.id==="recycle"&&trashedItems.length?"▨":app.icon,open:()=>launchApp(app.id)}));
  const contextApp=contextMenu?.appKey?appEntries.find((app)=>app.key===contextMenu.appKey)??null:null;
  const contextTargets=contextItem?(selectedIds.includes(contextItem.id)?visibleItems.filter((item)=>selectedIds.includes(item.id)):[contextItem]):[];
  const searchText=searchQuery.trim().toLowerCase(),searchApps=searchText?appEntries.filter((app)=>`${app.label} ${app.kind}`.toLowerCase().includes(searchText)):[],searchItems=searchText?visibleItems.filter((item)=>item.name.toLowerCase().includes(searchText)||(item.type==="text"&&item.content.toLowerCase().includes(searchText))):[],searchBooks=searchText?readerSearchBooks.filter((book)=>`${book.title} ${book.author}`.toLowerCase().includes(searchText)):[],searchSettings=searchText?SETTINGS_SEARCH_ENTRIES.filter((entry)=>`${entry.label} ${entry.detail} ${entry.keywords}`.toLowerCase().includes(searchText)):[];
  const searchSystem=searchText&&"日期与通知 日历 通知 文件活动".includes(searchText)?[{key:"system:notifications",label:"日期与通知",icon:"◷",detail:"系统面板",open:()=>{focusDesktop();setSystemPanelOpen(true)}}]:[];
  const searchResults=[...searchApps.map((app)=>({key:`app:${app.key}`,label:app.label,icon:app.icon,detail:"应用",open:app.open})),...searchItems.map((item)=>({key:item.id,label:item.name,icon:item.type==="folder"?"▱":item.type==="image"?"▧":"TXT",detail:`${item.type==="folder"?"文件夹":item.type==="image"?"照片":"文本文稿"} · 打开所在位置`,open:()=>launchTarget({app:"explorer",kind:"file",itemId:item.id,parentId:item.parentId})})),...searchBooks.map((book)=>({key:`book:${book.id}`,label:book.title,icon:"阅",detail:`书籍 · ${book.author}`,open:()=>launchTarget({app:"reader",kind:"book",bookId:book.id})})),...searchSettings.map((entry)=>({key:entry.key,label:entry.label,icon:"⚙",detail:entry.detail,open:()=>launchTarget({app:"settings",kind:"section",sectionId:entry.sectionId})})),...searchSystem];
  const closeStartMenu=()=>{setStartOpen(false);setSearchQuery("");setSearchIndex(0);setStartMode("launcher")};
  const runSearchResult=(index:number)=>{const result=searchResults[index];if(!result)return;result.open();closeStartMenu()};
  const windowProps=<App extends WindowAppId>(app:App)=>{const definition=APP_REGISTRY[app],state=windowStates[app];return{app,icon:definition.windowIcon??definition.icon,minimized:state.minimized,maximized:state.maximized,snapMode:state.snapMode,focused:focused===app,zIndex:20+state.z,onFocus:()=>focusWindow(app),onClose:()=>closeWindow(app),onMinimize:()=>minimizeWindow(app),onMaximize:()=>toggleMaximizeWindow(app),onSnap:(mode:WindowSnapMode)=>snapWindow(app,mode),onUnsnap:()=>updateWindow(app,{snapMode:undefined})}};
  const taskbarApps=REGISTERED_APPS.filter((app)=>app.taskbarPinned||windowStates[app.id].open);
  const taskbarLabel=(app:AppDefinition)=>taskbarTitles[app.id]??app.label;
  const focusedWindowState=focused==="desktop"?null:windowStates[focused];
  const taskbarAutoHide=!!focusedWindowState?.open&&!focusedWindowState.minimized&&focusedWindowState.maximized;
  const mobileWindowOpen=REGISTERED_APPS.some((app)=>windowStates[app.id].open&&!windowStates[app.id].minimized);
  const taskbarMenuApp=taskbarMenu?APP_REGISTRY[taskbarMenu.app]:null;
  const darkTheme=settings.theme==="dark"||(settings.theme==="system"&&systemDark);
  const calendarGrid=calendarDays(calendarMonth.getFullYear(),calendarMonth.getMonth());
  const calendarTitle=new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long"}).format(calendarMonth);
  const updateSettings=useCallback((next:NovaSettings)=>{setSettings(next);saveNovaSettings(next)},[]);
  const setWindowTitle=useCallback((app:WindowAppId,title?:string,taskbar=false)=>{
    setWindowTitles((current)=>current[app]===title?current:{...current,[app]:title});
    if(taskbar)setTaskbarTitles((current)=>current[app]===title?current:{...current,[app]:title});
  },[]);
  const windowRuntime=useMemo(()=>({windows:windowStates,focused,windowTitles,taskbarTitles,openApp:openWindow,isAppActive:(app:WindowAppId)=>windowIsActive(windowStates,focused,app),setWindowTitle}),[focused,openWindow,setWindowTitle,taskbarTitles,windowStates,windowTitles]);
  const launchRuntime=useMemo<LaunchRuntimeValue>(()=>({intent:launchIntent,markHandled:handleLaunchHandled}),[handleLaunchHandled,launchIntent]);
  const settingsRuntime=useMemo<SettingsRuntimeValue>(()=>({settings,updateSettings}),[settings,updateSettings]);
  const openMobileSearch=()=>{if(mobileWindowOpen)return;setStartMode("search");setStartOpen(true);setSearchQuery("");setSearchIndex(0);setContextMenu(null);setSystemPanelOpen(false)};
  const beginMobileSearchPull=(event:ReactPointerEvent<HTMLElement>)=>{
    const target=event.target as HTMLElement,desktop=target.closest<HTMLElement>(".desktop-files");
    if(event.pointerType==="touch"||!isCompactDesktopViewport()||mobileWindowOpen||startOpen||!desktop||desktop.scrollTop>0||target.closest(".desktop-item,.desktop-shortcut,.desktop-menu"))return;
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
  const desktopEntryIds=[...appEntries.map((app)=>`app:${app.key}`),...rootItems.map((item)=>item.id)];
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
  const importFiles=async(fileList:FileList|File[])=>{const files=Array.from(fileList),accepted=files.filter((file)=>file.type.startsWith("image/")||file.type==="text/plain"||file.name.toLowerCase().endsWith(".txt"));if(!accepted.length){setToast("暂时只支持图片和 TXT 文件");setDraggingFiles(false);return}const records=await Promise.all(accepted.map(async(file)=>({type:(file.type.startsWith("image/")?"image":"text") as DesktopItem["type"],name:file.name,content:await readBrowserFile(file,file.type.startsWith("image/")?"data":"text")})));rememberFileUndo("导入文件");setItems((current)=>{const next=[...current];for(const record of records){const dot=record.name.lastIndexOf("."),base=dot>0?record.name.slice(0,dot):record.name,extension=dot>0?record.name.slice(dot):"";let name=record.name,index=2;while(next.some((item)=>!item.deletedAt&&item.name===name)){name=`${base} ${index}${extension}`;index++}next.push({id:crypto.randomUUID(),type:record.type,name,content:record.content,parentId:null,createdAt:Date.now()})}return next});setDraggingFiles(false);notifyFile(`${records.length} 个文件已上传到桌面`)};
  const selectItem=(id:string,event:ReactMouseEvent)=>{focusDesktop();if(event.ctrlKey||event.metaKey||event.shiftKey)setSelectedIds((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);else setSelectedIds([id])};
  const openItemMenu=(item:DesktopItem,x:number,y:number)=>{if(!selectedIds.includes(item.id))setSelectedIds([item.id]);setContextMenu({x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-235),itemId:item.id});setStartOpen(false)};
  const beginRename=(item:DesktopItem)=>{setRenameItemId(item.id);setRenameValue(item.name);setContextMenu(null)};
  const finishRename=()=>{const name=renameValue.trim(),source=renameItemId?items.find((item)=>item.id===renameItemId):null;if(source&&name&&name!==source.name){rememberFileUndo("重命名项目");setItems(items.map((item)=>item.id===source.id?{...item,name}:item));notifyFile(`${source.name} 已重命名为 ${name}`,source.id)}setRenameItemId(null)};
  const arrangeIcons=(mode:"name"|"type"|"clean")=>{const entries=[...appEntries.map((app)=>({id:`app:${app.key}`,label:app.label,type:"app"})),...rootItems.map((item)=>({id:item.id,label:item.name,type:item.type}))];if(mode==="name")entries.sort((a,b)=>a.label.localeCompare(b.label,"zh-CN"));if(mode==="type")entries.sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label,"zh-CN"));const rows=Math.max(1,Math.floor((window.innerHeight-78)/90));setPositions((current)=>({...current,...Object.fromEntries(entries.map((entry,index)=>[entry.id,{x:Math.floor(index/rows)*89,y:index%rows*90}]))}));setContextMenu(null);setToast(mode==="clean"?"桌面图标已整理":mode==="name"?"已按名称排序":"已按类型排序")};
  const activateFromTaskbar=(app:WindowAppId)=>{const state=windowStates[app];if(state.open&&!state.minimized&&focused===app){minimizeWindow(app);return}openWindow(app)};
  const cycleWindows=useCallback((reverse=false)=>{const ordered=REGISTERED_APPS.filter((app)=>windowStates[app.id].open).sort((a,b)=>windowStates[b.id].z-windowStates[a.id].z).map((app)=>app.id);if(!ordered.length)return;const apps=altTab?.apps.filter((app)=>windowStates[app].open)??ordered,index=apps.indexOf(altTab?.active??(focused==="desktop"?apps[0]:focused)),next=apps[(index+(reverse?-1:1)+apps.length)%apps.length];openWindow(next);setAltTab({apps,active:next});if(altTabTimerRef.current)window.clearTimeout(altTabTimerRef.current);altTabTimerRef.current=window.setTimeout(()=>setAltTab(null),900)},[altTab,focused,openWindow,windowStates]);
  const workspaceRuntime:WorkspaceRuntimeValue={
    items,
    visibleItems,
    clipboard:fileClipboard,
    canUndo:!!fileUndo,
    activeNote,
    noteItems,
    activeImage,
    imageItems:visibleItems.filter((item)=>item.type==="image"),
    activeFolder,
    folderItems:activeFolder?visibleItems.filter((item)=>item.parentId===activeFolder.id):[],
    activeFolderId,
    photoEditorSource,
    trashedItems,
    selectNote:setActiveNoteId,
    createText,
    createFolder,
    updateItem,
    removeNote,
    openItem,
    openItemWith,
    openImage:(item)=>setActiveImageId(item.id),
    clearActiveImage:()=>setActiveImageId(null),
    editImage:(item)=>openItemWith(item,"photo"),
    navigateExplorer:(folderId)=>{setActiveFolderId(folderId);if(folderId)updateItem(folderId,{lastOpenedAt:Date.now()})},
    renameItem:beginRename,
    setClipboard,
    paste:pasteClipboard,
    performFileOperation:requestFileOperation,
    trashFromExplorer:(ids)=>{moveManyToRecycleBin(ids);focusWindow("explorer")},
    undoFileOperation,
    openRecycleBin:()=>openWindow("recycle"),
    goBackFolder:()=>{if(activeFolder?.parentId)setActiveFolderId(activeFolder.parentId);else closeWindow("folder")},
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
      if(event.metaKey&&focused!=="desktop"&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();const state=windowStates[focused],action=windowShortcutAction(state.snapMode,state.maximized,event.key as "ArrowLeft"|"ArrowRight"|"ArrowUp"|"ArrowDown");if(action==="maximize")updateWindow(focused,{maximized:true,snapMode:undefined});else if(action==="restore")updateWindow(focused,{maximized:false,snapMode:undefined});else if(action==="minimize")minimizeWindow(focused);else snapWindow(focused,action);return}
      if(command&&key==="w"){event.preventDefault();if(focused!=="desktop")closeWindow(focused);setContextMenu(null);setStartOpen(false);setSearchQuery("");return}
      if(typing&&!(focused==="notes"&&command&&(key==="s"||key==="n")))return;
      if(command&&key==="c"&&focused==="desktop"&&selectedIds.length){event.preventDefault();setClipboard("copy",selectedIds);return}
      if(command&&key==="x"&&focused==="desktop"&&selectedIds.length){event.preventDefault();setClipboard("move",selectedIds);return}
      if(command&&key==="v"&&focused==="desktop"&&fileClipboard){event.preventDefault();pasteClipboard(null);return}
      if(command&&key==="z"&&focused==="desktop"&&fileUndo){event.preventDefault();undoFileOperation();return}
      if(command&&key==="s"&&focused==="notes"&&activeNote){event.preventDefault();setToast(`${activeNote.name} 已保存到桌面`);return}
      if(command&&key==="n"&&focused==="notes"){event.preventDefault();createText();return}
      if(command&&key==="a"&&focused==="desktop"){event.preventDefault();setSelectedIds(rootItems.map((item)=>item.id));return}
      if(event.shiftKey&&event.key==="F10"&&focused==="desktop"&&!selectedIds.length){event.preventDefault();setContextMenu({x:48,y:48});setStartOpen(false);return}
      if(event.key==="F2"&&focused==="desktop"&&selectedIds.length===1){const item=items.find((entry)=>entry.id===selectedIds[0]);if(item){event.preventDefault();beginRename(item)}return}
      if(event.key==="Delete"&&focused==="desktop"&&selectedIds.length){event.preventDefault();moveManyToRecycleBin(selectedIds);return}
      if(event.altKey&&event.key==="F4"){event.preventDefault();if(focused!=="desktop")closeWindow(focused);return}
      if(event.key==="Escape"&&(contextMenu||taskbarMenu||startOpen||pendingFileOperation||systemPanelOpen)){event.preventDefault();setContextMenu(null);setTaskbarMenu(null);setStartOpen(false);setPendingFileOperation(null);setSystemPanelOpen(false);setSearchQuery("")}
    };
    window.addEventListener("keydown",shortcut);
    return()=>window.removeEventListener("keydown",shortcut)
  },[activeNote,closeWindow,contextMenu,cycleWindows,fileClipboard,fileUndo,focused,items,minimizeWindow,pendingFileOperation,selectedIds,snapWindow,startOpen,systemPanelOpen,taskbarMenu,updateWindow,windowStates]);
  return <WindowRuntimeProvider value={windowRuntime}><LaunchRuntimeProvider value={launchRuntime}><SettingsRuntimeProvider value={settingsRuntime}><WorkspaceRuntimeProvider value={workspaceRuntime}><main className={`super-desktop windows-desktop wallpaper-${settings.wallpaper} ${darkTheme?"theme-dark":"theme-light"} ${taskbarAutoHide?"taskbar-auto-hide":""} ${taskbarRevealed?"taskbar-revealed":""} ${mobileWindowOpen?"mobile-window-open":""} ${startOpen?"start-menu-open":""} ${systemPanelOpen?"system-panel-open":""}`} onPointerMove={(event)=>{updateMobileSearchPull(event);if(!taskbarAutoHide)return;const target=event.target as HTMLElement,reveal=event.clientY>=event.currentTarget.clientHeight-10||!!target.closest(".windows-taskbar,.start-menu,.taskbar-window-menu,.system-panel");if(reveal!==taskbarRevealed)setTaskbarRevealed(reveal)}} onPointerDown={(event)=>{beginMobileSearchPull(event);const target=event.target as HTMLElement;if(!target.closest(".desktop-item,.desktop-shortcut,.rename-dialog,.file-operation-dialog"))setSelectedIds([]);if(!target.closest(".desktop-menu"))setContextMenu(null);if(!target.closest(".taskbar-window-menu,.taskbar-entry"))setTaskbarMenu(null);if(!target.closest(".taskbar-entry"))setTaskbarPreview(null);if(!target.closest(".system-panel,.taskbar-clock"))setSystemPanelOpen(false);if(!target.closest(".start-menu,.start-button")){setStartOpen(false);setSearchQuery("")}}} onPointerUp={endMobileSearchPull} onPointerCancel={endMobileSearchPull} onTouchStart={beginMobileSearchTouch} onTouchMove={updateMobileSearchTouch} onTouchEnd={endMobileSearchTouch} onTouchCancel={endMobileSearchTouch} onContextMenu={(event)=>{if((event.target as HTMLElement).closest(".desktop-window,.windows-taskbar,.desktop-item,.desktop-shortcut"))return;event.preventDefault();setContextMenu({x:Math.min(event.clientX,window.innerWidth-225),y:Math.min(event.clientY,window.innerHeight-250)});focusDesktop();setStartOpen(false)}} onDragOver={(event)=>{if((event.target as HTMLElement).closest(".desktop-window"))return;const internal=event.dataTransfer.types.includes(NOVA_FILE_DRAG_TYPE);event.preventDefault();event.dataTransfer.dropEffect=internal?(event.ctrlKey||event.metaKey?"copy":"move"):"copy";setDraggingFiles(!internal)}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDraggingFiles(false)}} onDrop={(event)=>{if((event.target as HTMLElement).closest(".desktop-window"))return;event.preventDefault();setDraggingFiles(false);desktopDragIconRef.current=null;const ids=readDesktopDragIds(event.dataTransfer);if(ids.length){const alreadyOnDesktop=ids.every((id)=>items.find((item)=>item.id===id)?.parentId===null);if(!alreadyOnDesktop||event.ctrlKey||event.metaKey)requestFileOperation(event.ctrlKey||event.metaKey?"copy":"move",ids,null)}else void importFiles(event.dataTransfer.files)}}>
    <input ref={desktopUploadRef} className="desktop-upload-input" aria-label="上传桌面文件" type="file" accept="image/*,.txt,text/plain" multiple onChange={(event)=>{if(event.target.files?.length)importFiles(event.target.files);event.target.value=""}}/>
    <div className="windows-wallpaper"><i/><i/><i/></div>
    <section className="desktop-files" aria-label="桌面图标">{appEntries.map((app,index)=><DesktopShortcut key={app.key} id={`app:${app.key}`} label={app.label} icon={app.icon} kind={app.kind} position={positionFor(`app:${app.key}`,index)} order={desktopEntryOrder.get(`app:${app.key}`)??index} move={moveIcon} open={app.open} onIconDragEnter={(targetId)=>{const sourceId=desktopDragIconRef.current;if(sourceId)reorderIcon(sourceId,targetId)}} onContextMenu={(x,y)=>{setContextMenu({x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-100),appKey:app.key});setStartOpen(false)}}/>)}{rootItems.map((item,index)=><DesktopFile key={item.id} item={item} position={positionFor(item.id,appEntries.length+index)} order={desktopEntryOrder.get(item.id)??appEntries.length+index} move={moveIcon} selected={selectedIds.includes(item.id)} cut={fileClipboard?.mode==="move"&&fileClipboard.ids.includes(item.id)} onSelect={(event)=>selectItem(item.id,event)} onOpen={()=>openItem(item)} onDragStart={(event)=>{desktopDragIconRef.current=item.id;const ids=selectedIds.includes(item.id)?selectedIds:[item.id];if(!selectedIds.includes(item.id))setSelectedIds(ids);event.dataTransfer.effectAllowed="copyMove";event.dataTransfer.setData(NOVA_FILE_DRAG_TYPE,JSON.stringify(ids));event.dataTransfer.setData("text/plain",ids.join(","))}} onDragEnd={()=>{desktopDragIconRef.current=null}} onIconDragEnter={(targetId)=>{const sourceId=desktopDragIconRef.current;if(sourceId)reorderIcon(sourceId,targetId)}} onFileDrop={item.type==="folder"?(event)=>{desktopDragIconRef.current=null;const ids=readDesktopDragIds(event.dataTransfer);if(!ids.length)return;event.preventDefault();event.stopPropagation();requestFileOperation(event.ctrlKey||event.metaKey?"copy":"move",ids,item.id)}:undefined} onContextMenu={(x,y)=>openItemMenu(item,x,y)}/>)}</section>
    {contextMenu&&<div className="desktop-menu" style={{left:contextMenu.x,top:contextMenu.y}}>{contextApp?<button onClick={contextApp.open}>打开 {contextApp.label}</button>:contextItem?<>{contextTargets.length===1?<><button onClick={()=>openItem(contextItem)}>打开</button>{fileOpenOptions(contextItem.type).filter((option)=>!option.primary).map((option)=><button key={option.app} onClick={()=>openItemWith(contextItem,option.app)}>使用{option.label}打开</button>)}<button onClick={()=>beginRename(contextItem)}>重命名</button>{contextItem.type==="folder"&&<><button onClick={()=>createFolder(contextItem.id)}>在文件夹中新建文件夹</button><button onClick={()=>createText(contextItem.id)}>在文件夹中新建文本</button>{fileClipboard&&<button onClick={()=>pasteClipboard(contextItem.id)}>粘贴到此文件夹</button>}</>}{contextItem.type!=="folder"&&<button onClick={()=>downloadItem(contextItem)}>保存到下载</button>}<span/></>:<p className="menu-summary">已选择 {contextTargets.length} 个项目</p>}<button onClick={()=>setClipboard("move",contextTargets.map((item)=>item.id))}>剪切</button><button onClick={()=>setClipboard("copy",contextTargets.map((item)=>item.id))}>复制</button><button className="danger" onClick={()=>moveManyToRecycleBin(contextTargets.map((item)=>item.id))}>移到回收站</button><button className="danger" onClick={()=>permanentlyDeleteMany(contextTargets.map((item)=>item.id))}>直接删除</button></>:<><button onClick={()=>createFolder()}>新建文件夹</button><button onClick={()=>createText()}>新建文本文稿</button>{fileClipboard&&<button onClick={()=>pasteClipboard(null)}>粘贴</button>}<button onClick={()=>{desktopUploadRef.current?.click();setContextMenu(null)}}>上传图片或 TXT</button>{fileUndo&&<button onClick={undoFileOperation}>撤销“{fileUndo.label}”</button>}<span/><button onClick={()=>arrangeIcons("name")}>按名称排序</button><button onClick={()=>arrangeIcons("type")}>按类型排序</button><button onClick={()=>arrangeIcons("clean")}>整理图标</button></>}</div>}
    {REGISTERED_APPS.map((app)=>windowStates[app.id].open&&<AppHost key={app.id} {...windowProps(app.id)}/>)}
    {altTab&&<section className="window-switcher" role="dialog" aria-label="切换窗口">{altTab.apps.filter((app)=>windowStates[app].open).map((app)=>{const definition=APP_REGISTRY[app];return <div key={app} className={altTab.active===app?"active":""}><span className={`app-glyph ${app}-glyph`}>{definition.windowIcon??definition.icon}</span><strong>{taskbarLabel(definition)}</strong></div>})}</section>}
    {startOpen&&<button className="start-menu-scrim" type="button" aria-label={startMode==="search"?"关闭搜索":"关闭开始菜单"} onClick={closeStartMenu}/>}
    {startOpen&&<StartMenu mode={startMode} apps={appEntries} searchQuery={searchQuery} searchIndex={searchIndex} searchResults={searchResults} onSearchQueryChange={setSearchQuery} onSearchIndexChange={setSearchIndex} onRunSearchResult={runSearchResult} onClose={closeStartMenu}/>}
    {systemPanelOpen&&<DesktopSystemPanel calendarTitle={calendarTitle} calendarGrid={calendarGrid} notifications={notifications} visibleItems={visibleItems} onPreviousMonth={()=>setCalendarMonth((current)=>new Date(current.getFullYear(),current.getMonth()-1,1))} onCurrentMonth={()=>setCalendarMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))} onNextMonth={()=>setCalendarMonth((current)=>new Date(current.getFullYear(),current.getMonth()+1,1))} onClearNotifications={()=>setNotifications([])} onLocateItem={(target)=>launchTarget({app:"explorer",kind:"file",itemId:target.id,parentId:target.parentId})}/>}
    <DesktopTaskbar apps={taskbarApps} windows={windowStates} focused={focused} clock={clock} notificationCount={notifications.length} startOpen={startOpen} previewApp={taskbarPreview} menu={taskbarMenu} menuApp={taskbarMenuApp} labelFor={taskbarLabel} onPreviewChange={setTaskbarPreview} onMenuChange={setTaskbarMenu} onRevealChange={setTaskbarRevealed} onToggleStart={()=>{setTaskbarPreview(null);setStartMode("launcher");setStartOpen(!startOpen);setSystemPanelOpen(false);setSearchQuery("");setSearchIndex(0);setContextMenu(null);setTaskbarMenu(null)}} onActivate={activateFromTaskbar} onOpen={openWindow} onMinimize={minimizeWindow} onToggleMaximize={(app)=>{if(windowStates[app].minimized)openWindow(app);toggleMaximizeWindow(app);setTaskbarMenu(null)}} onClose={closeWindow} onOpenCalendar={()=>openWindow("calendar")} canHide={!startOpen&&!taskbarMenu&&!systemPanelOpen}/>
    <DesktopOverlays renameItemId={renameItemId} renameValue={renameValue} pendingFileOperation={pendingFileOperation} draggingFiles={draggingFiles} toast={toast} booting={booting} onRenameValueChange={setRenameValue} onCancelRename={()=>setRenameItemId(null)} onFinishRename={finishRename} onCancelFileOperation={()=>setPendingFileOperation(null)} onPerformFileOperation={performFileOperation}/>
  </main></WorkspaceRuntimeProvider></SettingsRuntimeProvider></LaunchRuntimeProvider></WindowRuntimeProvider>
}
