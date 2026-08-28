"use client";

import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AppLoadBoundary from "./AppLoadBoundary";
import StartMenu from "./StartMenu";
import {
  APP_REGISTRY,
  LAUNCHER_APPS,
  REGISTERED_APPS,
  type AppDefinition,
  type WindowAppId,
} from "./appRegistry";
import {
  createAppLaunchIntent,
  launchIntentFor,
  type AppLaunchIntent,
  type AppLaunchTarget,
} from "./appLaunch";
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
  type FileOperationConflict,
  type FileOperationMode,
} from "./desktopFiles";
import { createDesktopSyncQueue, loadDesktopItems } from "./desktopStorage";
import {
  appendDesktopNotification,
  calendarDays,
  type DesktopNotification,
} from "./desktopSystem";
import {
  defaultFileOpenApp,
  fileOpenOptions,
  type FileOpenApp,
} from "./fileAssociations";
import { playNovaSound, readNovaSettings, saveNovaSettings, type NovaSettings } from "./novaSettings";
import PwaManager from "./PwaManager";
import type { StoredBookSummary } from "./readerCore";
import { getStoredBookSummaries } from "./readerStorage";
import {
  LazyCalculatorApp,
  LazyChessGame,
  LazyDrawingApp,
  LazyFileExplorer,
  LazyFocusClockApp,
  LazyFolderViewApp,
  LazyGameHall,
  LazyGoGame,
  LazyGomokuGame,
  LazyMagicTowerGame,
  LazyMinesweeperGame,
  LazyNotepadApp,
  LazyPhotoEditor,
  LazyPhotoViewerApp,
  LazyReaderApp,
  LazyRecycleBinApp,
  LazySettingsApp,
  LazyStarVoyageGame,
  LazySudokuGame,
} from "./lazyApps";
import {
  edgeSnapMode,
  snappedWindowGeometry,
  windowShortcutAction,
  type WindowGeometry,
  type WindowSnapMode,
} from "./windowGeometry";

type AppId = "desktop" | WindowAppId;
type WindowState = { open:boolean; minimized:boolean; maximized:boolean; z:number; snapMode?:WindowSnapMode };
type WindowStateMap = Record<WindowAppId,WindowState>;
type ContextMenuState = { x: number; y: number; itemId?: string; appKey?: WindowAppId };
type TaskbarMenuState = { app:WindowAppId; x:number };
type AltTabState = { apps:WindowAppId[]; active:WindowAppId };
type PhotoSource = { id?: string; name: string; content: string };
type IconPosition = { x: number; y: number };
type PendingFileOperation = {
  mode: FileOperationMode;
  ids: string[];
  parentId: string | null;
  conflicts: FileOperationConflict[];
};
type FileUndoAction = {
  items: DesktopItem[];
  positions: Record<string, IconPosition>;
  label: string;
};
const POSITION_STORAGE_KEY = "nova-desktop-positions";
const WINDOW_GEOMETRY_PREFIX = "nova-window-geometry:";
const SETTINGS_SEARCH_ENTRIES=[
  {key:"settings:theme",sectionId:"theme",label:"主题",detail:"设置 · 个性化",keywords:"明亮 深色 跟随系统"},
  {key:"settings:sound",sectionId:"sound",label:"声音与音量",detail:"设置 · 声音",keywords:"静音 音效 音量"},
  {key:"settings:backup",sectionId:"backup",label:"本地备份与恢复",detail:"设置 · 本地数据",keywords:"导入 导出 存储 数据"},
  {key:"settings:games",sectionId:"backup",label:"清除游戏记录",detail:"设置 · 本地数据",keywords:"存档 战绩 重置"},
];
const readDesktopDragIds=(dataTransfer:DataTransfer)=>{try{const value=JSON.parse(dataTransfer.getData(NOVA_FILE_DRAG_TYPE));return Array.isArray(value)?value.filter((id):id is string=>typeof id==="string"):[]}catch{return[]}};
const createInitialWindowState=()=>Object.fromEntries(REGISTERED_APPS.map((app)=>[app.id,{open:false,minimized:false,maximized:false,z:0}])) as WindowStateMap;
const topWindow=(states:WindowStateMap,exclude?:WindowAppId)=>REGISTERED_APPS.filter((app)=>app.id!==exclude&&states[app.id].open&&!states[app.id].minimized).sort((a,b)=>states[b.id].z-states[a.id].z)[0]?.id??"desktop";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const readBrowserFile=(file:File,mode:"text"|"data")=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result??""));reader.onerror=()=>reject(reader.error);if(mode==="text")reader.readAsText(file);else reader.readAsDataURL(file)});
const fitWindowGeometry=(geometry:WindowGeometry):WindowGeometry=>{const width=clamp(geometry.width,320,Math.max(320,window.innerWidth-8)),height=clamp(geometry.height,260,Math.max(260,window.innerHeight-57));return{x:clamp(geometry.x,0,Math.max(0,window.innerWidth-width)),y:clamp(geometry.y,0,Math.max(0,window.innerHeight-49-height)),width,height}};
const readWindowGeometry=(app:WindowAppId)=>{const saved=localStorage.getItem(`${WINDOW_GEOMETRY_PREFIX}${app}`);return saved?fitWindowGeometry(JSON.parse(saved) as WindowGeometry):null};

export default function Home() {
  const [items,setItems]=useState<DesktopItem[]>([]),[positions,setPositions]=useState<Record<string,IconPosition>>({}),[storageState,setStorageState]=useState<"loading"|"ready"|"error">("loading"),[selectedIds,setSelectedIds]=useState<string[]>([]);
  const [windowStates,setWindowStates]=useState<WindowStateMap>(createInitialWindowState);
  const [photoSourceId,setPhotoSourceId]=useState<string|null>(null),[activeNoteId,setActiveNoteId]=useState<string|null>(null),[activeImageId,setActiveImageId]=useState<string|null>(null),[activeFolderId,setActiveFolderId]=useState<string|null>(null);
  const [focused,setFocused]=useState<AppId>("desktop"),[clock,setClock]=useState(""),[contextMenu,setContextMenu]=useState<ContextMenuState|null>(null),[taskbarMenu,setTaskbarMenu]=useState<TaskbarMenuState|null>(null),[taskbarPreview,setTaskbarPreview]=useState<WindowAppId|null>(null),[altTab,setAltTab]=useState<AltTabState|null>(null),[startOpen,setStartOpen]=useState(false),[searchQuery,setSearchQuery]=useState(""),[searchIndex,setSearchIndex]=useState(0),[readerSearchBooks,setReaderSearchBooks]=useState<StoredBookSummary[]>([]),[toast,setToast]=useState(""),[taskbarRevealed,setTaskbarRevealed]=useState(false);
  const [renameItemId,setRenameItemId]=useState<string|null>(null),[renameValue,setRenameValue]=useState(""),[booting,setBooting]=useState(true),[draggingFiles,setDraggingFiles]=useState(false);
  const [fileClipboard,setFileClipboard]=useState<FileClipboard|null>(null),[pendingFileOperation,setPendingFileOperation]=useState<PendingFileOperation|null>(null),[fileUndo,setFileUndo]=useState<FileUndoAction|null>(null);
  const [launchIntent,setLaunchIntent]=useState<AppLaunchIntent|null>(null),[systemPanelOpen,setSystemPanelOpen]=useState(false),[notifications,setNotifications]=useState<DesktopNotification[]>([]),[calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [settings,setSettings]=useState<NovaSettings>(readNovaSettings),[systemDark,setSystemDark]=useState(false);
  const desktopUploadRef=useRef<HTMLInputElement>(null);
  const desktopSyncRef=useRef<ReturnType<typeof createDesktopSyncQueue>|null>(null);
  const windowZRef=useRef(1),altTabTimerRef=useRef<number|null>(null),launchRequestRef=useRef(0),notificationIdRef=useRef(0);

  useEffect(()=>{let cancelled=false;const timer=setTimeout(()=>setBooting(false),1450);const load=async()=>{try{const savedItems=await loadDesktopItems();if(cancelled)return;desktopSyncRef.current=createDesktopSyncQueue(savedItems);setItems(savedItems);setStorageState("ready")}catch{if(!cancelled){setStorageState("error");setToast("桌面文件读取失败")}}if(!cancelled){const savedPositions=localStorage.getItem(POSITION_STORAGE_KEY);try{setPositions(savedPositions?JSON.parse(savedPositions):{})}catch{setPositions({})}}};void load();return()=>{cancelled=true;clearTimeout(timer)}},[]);
  useEffect(()=>{if(storageState!=="ready"||!desktopSyncRef.current)return;void desktopSyncRef.current.enqueue(items).catch(()=>setToast("桌面文件保存失败"))},[items,storageState]);
  useEffect(()=>{if(storageState==="ready")localStorage.setItem(POSITION_STORAGE_KEY,JSON.stringify(positions))},[positions,storageState]);
  useEffect(()=>{if(!startOpen)return;let cancelled=false;void getStoredBookSummaries().then((books)=>{if(!cancelled)setReaderSearchBooks(books)});return()=>{cancelled=true}},[startOpen]);
  useEffect(()=>{const update=()=>setClock(new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()));update();const timer=setInterval(update,30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),1800);return()=>clearTimeout(timer)},[toast]);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)"),update=()=>setSystemDark(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update)},[]);

  const visibleItems=useMemo(()=>visibleDesktopItems(items),[items]);
  const updateWindow=useCallback((app:WindowAppId,patch:Partial<WindowState>)=>setWindowStates((current)=>({...current,[app]:{...current[app],...patch}})),[]);
  const focusWindow=useCallback((app:WindowAppId)=>{const z=++windowZRef.current;updateWindow(app,{z});setFocused(app)},[updateWindow]);
  const openWindow=useCallback((app:WindowAppId)=>{const z=++windowZRef.current;updateWindow(app,{open:true,minimized:false,z});setFocused(app);setStartOpen(false);setSystemPanelOpen(false);setContextMenu(null);setTaskbarMenu(null);setTaskbarPreview(null);setTaskbarRevealed(false);playNovaSound("open")},[updateWindow]);
  const launchTarget=useCallback((target:AppLaunchTarget)=>{setLaunchIntent(createAppLaunchIntent(++launchRequestRef.current,target));if(target.app==="explorer")setActiveFolderId(target.parentId);openWindow(target.app)},[openWindow]);
  const handleLaunchHandled=useCallback((requestId:number)=>setLaunchIntent((current)=>current?.requestId===requestId?null:current),[]);
  const notifyFile=(message:string,itemId?:string)=>{setToast(message);setNotifications((current)=>appendDesktopNotification(current,{id:++notificationIdRef.current,message,createdAt:Date.now(),itemId}))};
  const dismissWindow=useCallback((app:WindowAppId)=>updateWindow(app,{open:false}),[updateWindow]);
  const closeWindow=useCallback((app:WindowAppId)=>{dismissWindow(app);if(app==="photo")setPhotoSourceId(null);setFocused(topWindow(windowStates,app));setTaskbarMenu(null);setTaskbarPreview(null);setTaskbarRevealed(false);playNovaSound("close")},[dismissWindow,windowStates]);
  const minimizeWindow=useCallback((app:WindowAppId)=>{updateWindow(app,{minimized:true});setFocused(topWindow(windowStates,app));setTaskbarMenu(null);setTaskbarRevealed(false)},[updateWindow,windowStates]);
  const toggleMaximizeWindow=useCallback((app:WindowAppId)=>{setWindowStates((current)=>({...current,[app]:{...current[app],maximized:!current[app].maximized,snapMode:undefined}}));setTaskbarRevealed(false)},[]);
  const snapWindow=useCallback((app:WindowAppId,mode:WindowSnapMode)=>{updateWindow(app,{maximized:false,minimized:false,snapMode:mode});setFocused(app)},[updateWindow]);

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
  const moveManyToRecycleBin=(ids:string[])=>{const roots=topLevelDesktopItemIds(items,ids);if(!roots.length)return;const affected=descendantIds(items,roots);rememberFileUndo("移到回收站");setItems(trashDesktopItems(items,roots));closeAffected(affected);setSelectedIds([]);setContextMenu(null);setFocused("desktop");notifyFile(`${roots.length} 个项目已移到回收站`)};
  const setClipboard=(mode:FileOperationMode,ids:string[])=>{const roots=topLevelDesktopItemIds(items,ids);if(!roots.length)return;setFileClipboard({mode,ids:roots});setToast(`${roots.length} 个项目已${mode==="copy"?"复制":"剪切"}`)};
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
  const photoEditorSource=useMemo<PhotoSource|null>(()=>photoSourceItem?{id:photoSourceItem.id,name:photoSourceItem.name.replace(/\.[^.]+$/,"")||"照片",content:photoSourceItem.content}:null,[photoSourceItem?.content,photoSourceItem?.id,photoSourceItem?.name]);
  const launchApp=(app:WindowAppId)=>{if(app==="notes"){if(!activeNote)setActiveNoteId(noteItems[0]?.id??null);openWindow("notes");return}if(app==="viewer"&&!windowStates.viewer.open)setActiveImageId(null);if(app==="explorer")setActiveFolderId(null);openWindow(app)};
  const removeNote=(id:string)=>{const next=noteItems.find((item)=>item.id!==id);rememberFileUndo("删除文稿");setItems((current)=>trashDesktopItems(current,[id]));setActiveNoteId(next?.id??null);notifyFile("文稿已移到回收站")};
  const contextItem=contextMenu?.itemId?visibleItems.find((item)=>item.id===contextMenu.itemId)??null:null;
  const rootItems=visibleItems.filter((item)=>item.parentId===null);
  const trashedItems=recycleBinItems(items);
  const appEntries=LAUNCHER_APPS.map((app)=>({...app,key:app.id,icon:app.id==="recycle"&&trashedItems.length?"▨":app.icon,open:()=>launchApp(app.id)}));
  const contextApp=contextMenu?.appKey?appEntries.find((app)=>app.key===contextMenu.appKey)??null:null;
  const contextTargets=contextItem?(selectedIds.includes(contextItem.id)?visibleItems.filter((item)=>selectedIds.includes(item.id)):[contextItem]):[];
  const searchText=searchQuery.trim().toLowerCase(),searchApps=searchText?appEntries.filter((app)=>`${app.label} ${app.kind}`.toLowerCase().includes(searchText)):[],searchItems=searchText?visibleItems.filter((item)=>item.name.toLowerCase().includes(searchText)||(item.type==="text"&&item.content.toLowerCase().includes(searchText))):[],searchBooks=searchText?readerSearchBooks.filter((book)=>`${book.title} ${book.author}`.toLowerCase().includes(searchText)):[],searchSettings=searchText?SETTINGS_SEARCH_ENTRIES.filter((entry)=>`${entry.label} ${entry.detail} ${entry.keywords}`.toLowerCase().includes(searchText)):[];
  const searchResults=[...searchApps.map((app)=>({key:`app:${app.key}`,label:app.label,icon:app.icon,detail:"应用",open:app.open})),...searchItems.map((item)=>({key:item.id,label:item.name,icon:item.type==="folder"?"▱":item.type==="image"?"▧":"TXT",detail:`${item.type==="folder"?"文件夹":item.type==="image"?"照片":"文本文稿"} · 打开所在位置`,open:()=>launchTarget({app:"explorer",kind:"file",itemId:item.id,parentId:item.parentId})})),...searchBooks.map((book)=>({key:`book:${book.id}`,label:book.title,icon:"阅",detail:`书籍 · ${book.author}`,open:()=>launchTarget({app:"reader",kind:"book",bookId:book.id})})),...searchSettings.map((entry)=>({key:entry.key,label:entry.label,icon:"⚙",detail:entry.detail,open:()=>launchTarget({app:"settings",kind:"section",sectionId:entry.sectionId})}))];
  const runSearchResult=(index:number)=>{const result=searchResults[index];if(!result)return;result.open();setSearchQuery("");setSearchIndex(0)};
  const windowProps=(app:WindowAppId,title=APP_REGISTRY[app].label)=>{const definition=APP_REGISTRY[app],state=windowStates[app];return{app,title,icon:definition.windowIcon??definition.icon,minimized:state.minimized,maximized:state.maximized,snapMode:state.snapMode,focused:focused===app,zIndex:20+state.z,onFocus:()=>focusWindow(app),onClose:()=>closeWindow(app),onMinimize:()=>minimizeWindow(app),onMaximize:()=>toggleMaximizeWindow(app),onSnap:(mode:WindowSnapMode)=>snapWindow(app,mode),onUnsnap:()=>updateWindow(app,{snapMode:undefined})}};
  const taskbarApps=REGISTERED_APPS.filter((app)=>(app.taskbarPinned||windowStates[app.id].open)&&(app.id!=="folder"||activeFolder));
  const taskbarLabel=(app:AppDefinition)=>app.id==="folder"&&activeFolder?activeFolder.name:app.label;
  const focusedWindowState=focused==="desktop"?null:windowStates[focused];
  const taskbarAutoHide=!!focusedWindowState?.open&&!focusedWindowState.minimized&&focusedWindowState.maximized;
  const taskbarMenuApp=taskbarMenu?APP_REGISTRY[taskbarMenu.app]:null;
  const darkTheme=settings.theme==="dark"||(settings.theme==="system"&&systemDark);
  const calendarGrid=calendarDays(calendarMonth.getFullYear(),calendarMonth.getMonth());
  const calendarTitle=new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long"}).format(calendarMonth);
  const defaultPosition=(index:number):IconPosition=>({x:Math.floor(index/7)*89,y:index%7*90});
  const desktopEntryIds=[...appEntries.map((app)=>`app:${app.key}`),...rootItems.map((item)=>item.id)];
  const resolvedPositions=desktopEntryIds.reduce<Record<string,IconPosition>>((result,id)=>{
    const overlaps=(candidate:IconPosition)=>Object.values(result).some((position)=>Math.abs(position.x-candidate.x)<78&&Math.abs(position.y-candidate.y)<86);
    if(positions[id]&&!overlaps(positions[id])){result[id]=positions[id];return result}
    let slot=0;
    while(overlaps(defaultPosition(slot)))slot++;
    result[id]=defaultPosition(slot);
    return result;
  },{});
  const positionFor=(id:string,index:number)=>resolvedPositions[id]??defaultPosition(index);
  const moveIcon=(id:string,position:IconPosition)=>setPositions((current)=>({...current,[id]:position}));
  const importFiles=async(fileList:FileList|File[])=>{const files=Array.from(fileList),accepted=files.filter((file)=>file.type.startsWith("image/")||file.type==="text/plain"||file.name.toLowerCase().endsWith(".txt"));if(!accepted.length){setToast("暂时只支持图片和 TXT 文件");setDraggingFiles(false);return}const records=await Promise.all(accepted.map(async(file)=>({type:(file.type.startsWith("image/")?"image":"text") as DesktopItem["type"],name:file.name,content:await readBrowserFile(file,file.type.startsWith("image/")?"data":"text")})));rememberFileUndo("导入文件");setItems((current)=>{const next=[...current];for(const record of records){const dot=record.name.lastIndexOf("."),base=dot>0?record.name.slice(0,dot):record.name,extension=dot>0?record.name.slice(dot):"";let name=record.name,index=2;while(next.some((item)=>!item.deletedAt&&item.name===name)){name=`${base} ${index}${extension}`;index++}next.push({id:crypto.randomUUID(),type:record.type,name,content:record.content,parentId:null,createdAt:Date.now()})}return next});setDraggingFiles(false);notifyFile(`${records.length} 个文件已上传到桌面`)};
  const selectItem=(id:string,event:ReactMouseEvent)=>{setFocused("desktop");if(event.ctrlKey||event.metaKey||event.shiftKey)setSelectedIds((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);else setSelectedIds([id])};
  const openItemMenu=(item:DesktopItem,x:number,y:number)=>{if(!selectedIds.includes(item.id))setSelectedIds([item.id]);setContextMenu({x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-235),itemId:item.id});setStartOpen(false)};
  const beginRename=(item:DesktopItem)=>{setRenameItemId(item.id);setRenameValue(item.name);setContextMenu(null)};
  const finishRename=()=>{const name=renameValue.trim(),source=renameItemId?items.find((item)=>item.id===renameItemId):null;if(source&&name&&name!==source.name){rememberFileUndo("重命名项目");setItems(items.map((item)=>item.id===source.id?{...item,name}:item));notifyFile(`${source.name} 已重命名为 ${name}`,source.id)}setRenameItemId(null)};
  const arrangeIcons=(mode:"name"|"type"|"clean")=>{const entries=[...appEntries.map((app)=>({id:`app:${app.key}`,label:app.label,type:"app"})),...rootItems.map((item)=>({id:item.id,label:item.name,type:item.type}))];if(mode==="name")entries.sort((a,b)=>a.label.localeCompare(b.label,"zh-CN"));if(mode==="type")entries.sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label,"zh-CN"));const rows=Math.max(1,Math.floor((window.innerHeight-78)/90));setPositions((current)=>({...current,...Object.fromEntries(entries.map((entry,index)=>[entry.id,{x:Math.floor(index/rows)*89,y:index%rows*90}]))}));setContextMenu(null);setToast(mode==="clean"?"桌面图标已整理":mode==="name"?"已按名称排序":"已按类型排序")};
  const activateFromTaskbar=(app:WindowAppId)=>{const state=windowStates[app];if(state.open&&!state.minimized&&focused===app){minimizeWindow(app);return}openWindow(app)};
  const updateSettings=(next:NovaSettings)=>{setSettings(next);saveNovaSettings(next)};
  const cycleWindows=useCallback((reverse=false)=>{const ordered=REGISTERED_APPS.filter((app)=>windowStates[app.id].open).sort((a,b)=>windowStates[b.id].z-windowStates[a.id].z).map((app)=>app.id);if(!ordered.length)return;const apps=altTab?.apps.filter((app)=>windowStates[app].open)??ordered,index=apps.indexOf(altTab?.active??(focused==="desktop"?apps[0]:focused)),next=apps[(index+(reverse?-1:1)+apps.length)%apps.length];openWindow(next);setAltTab({apps,active:next});if(altTabTimerRef.current)window.clearTimeout(altTabTimerRef.current);altTabTimerRef.current=window.setTimeout(()=>setAltTab(null),900)},[altTab,focused,openWindow,windowStates]);
  useEffect(()=>()=>{if(altTabTimerRef.current)window.clearTimeout(altTabTimerRef.current)},[]);

  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      const command=event.ctrlKey||event.metaKey,key=event.key.toLowerCase(),target=event.target as HTMLElement,typing=target.matches("input,textarea,[contenteditable=true]");
      if(event.ctrlKey&&event.code==="Space"){event.preventDefault();setStartOpen((current)=>!current);setSearchQuery("");setSearchIndex(0);return}
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
  return <main className={`super-desktop windows-desktop ${darkTheme?"theme-dark":"theme-light"} ${taskbarAutoHide?"taskbar-auto-hide":""} ${taskbarRevealed?"taskbar-revealed":""} ${startOpen?"start-menu-open":""} ${systemPanelOpen?"system-panel-open":""}`} onPointerMove={(event)=>{if(!taskbarAutoHide)return;const target=event.target as HTMLElement,reveal=event.clientY>=event.currentTarget.clientHeight-10||!!target.closest(".windows-taskbar,.start-menu,.taskbar-window-menu,.system-panel");if(reveal!==taskbarRevealed)setTaskbarRevealed(reveal)}} onPointerDown={(event)=>{const target=event.target as HTMLElement;if(!target.closest(".desktop-item,.desktop-shortcut,.rename-dialog,.file-operation-dialog"))setSelectedIds([]);if(!target.closest(".desktop-menu"))setContextMenu(null);if(!target.closest(".taskbar-window-menu,.taskbar-entry"))setTaskbarMenu(null);if(!target.closest(".taskbar-entry"))setTaskbarPreview(null);if(!target.closest(".system-panel,.taskbar-clock"))setSystemPanelOpen(false);if(!target.closest(".start-menu,.start-button")){setStartOpen(false);setSearchQuery("")}}} onContextMenu={(event)=>{if((event.target as HTMLElement).closest(".desktop-window,.windows-taskbar,.desktop-item,.desktop-shortcut"))return;event.preventDefault();setContextMenu({x:Math.min(event.clientX,window.innerWidth-225),y:Math.min(event.clientY,window.innerHeight-250)});setFocused("desktop");setStartOpen(false)}} onDragOver={(event)=>{if((event.target as HTMLElement).closest(".desktop-window"))return;const internal=event.dataTransfer.types.includes(NOVA_FILE_DRAG_TYPE);event.preventDefault();event.dataTransfer.dropEffect=internal?(event.ctrlKey||event.metaKey?"copy":"move"):"copy";setDraggingFiles(!internal)}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDraggingFiles(false)}} onDrop={(event)=>{if((event.target as HTMLElement).closest(".desktop-window"))return;event.preventDefault();setDraggingFiles(false);const ids=readDesktopDragIds(event.dataTransfer);if(ids.length)requestFileOperation(event.ctrlKey||event.metaKey?"copy":"move",ids,null);else void importFiles(event.dataTransfer.files)}}>
    <input ref={desktopUploadRef} className="desktop-upload-input" aria-label="上传桌面文件" type="file" accept="image/*,.txt,text/plain" multiple onChange={(event)=>{if(event.target.files?.length)importFiles(event.target.files);event.target.value=""}}/>
    <div className="windows-wallpaper"><i/><i/><i/></div>
    <section className="desktop-files" aria-label="桌面图标">{appEntries.map((app,index)=><DesktopShortcut key={app.key} id={`app:${app.key}`} label={app.label} icon={app.icon} kind={app.kind} position={positionFor(`app:${app.key}`,index)} move={moveIcon} open={app.open} onContextMenu={(x,y)=>{setContextMenu({x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-100),appKey:app.key});setStartOpen(false)}}/>)}{rootItems.map((item,index)=><DesktopFile key={item.id} item={item} position={positionFor(item.id,appEntries.length+index)} move={moveIcon} selected={selectedIds.includes(item.id)} cut={fileClipboard?.mode==="move"&&fileClipboard.ids.includes(item.id)} onSelect={(event)=>selectItem(item.id,event)} onOpen={()=>openItem(item)} onDragStart={(event)=>{const ids=selectedIds.includes(item.id)?selectedIds:[item.id];if(!selectedIds.includes(item.id))setSelectedIds(ids);event.dataTransfer.effectAllowed="copyMove";event.dataTransfer.setData(NOVA_FILE_DRAG_TYPE,JSON.stringify(ids));event.dataTransfer.setData("text/plain",ids.join(","))}} onFileDrop={item.type==="folder"?(event)=>{const ids=readDesktopDragIds(event.dataTransfer);if(!ids.length)return;event.preventDefault();event.stopPropagation();requestFileOperation(event.ctrlKey||event.metaKey?"copy":"move",ids,item.id)}:undefined} onContextMenu={(x,y)=>openItemMenu(item,x,y)}/>)}</section>
    {contextMenu&&<div className="desktop-menu" style={{left:contextMenu.x,top:contextMenu.y}}>{contextApp?<button onClick={contextApp.open}>打开 {contextApp.label}</button>:contextItem?<>{contextTargets.length===1?<><button onClick={()=>openItem(contextItem)}>打开</button>{fileOpenOptions(contextItem.type).filter((option)=>!option.primary).map((option)=><button key={option.app} onClick={()=>openItemWith(contextItem,option.app)}>使用{option.label}打开</button>)}<button onClick={()=>beginRename(contextItem)}>重命名</button>{contextItem.type==="folder"&&<><button onClick={()=>createFolder(contextItem.id)}>在文件夹中新建文件夹</button><button onClick={()=>createText(contextItem.id)}>在文件夹中新建文本</button>{fileClipboard&&<button onClick={()=>pasteClipboard(contextItem.id)}>粘贴到此文件夹</button>}</>}{contextItem.type!=="folder"&&<button onClick={()=>downloadItem(contextItem)}>保存到下载</button>}<span/></>:<p className="menu-summary">已选择 {contextTargets.length} 个项目</p>}<button onClick={()=>setClipboard("move",contextTargets.map((item)=>item.id))}>剪切</button><button onClick={()=>setClipboard("copy",contextTargets.map((item)=>item.id))}>复制</button><button className="danger" onClick={()=>moveManyToRecycleBin(contextTargets.map((item)=>item.id))}>移到回收站</button><button className="danger" onClick={()=>permanentlyDeleteMany(contextTargets.map((item)=>item.id))}>直接删除</button></>:<><button onClick={()=>createFolder()}>新建文件夹</button><button onClick={()=>createText()}>新建文本文稿</button>{fileClipboard&&<button onClick={()=>pasteClipboard(null)}>粘贴</button>}<button onClick={()=>{desktopUploadRef.current?.click();setContextMenu(null)}}>上传图片或 TXT</button>{fileUndo&&<button onClick={undoFileOperation}>撤销“{fileUndo.label}”</button>}<span/><button onClick={()=>arrangeIcons("name")}>按名称排序</button><button onClick={()=>arrangeIcons("type")}>按类型排序</button><button onClick={()=>arrangeIcons("clean")}>整理图标</button></>}</div>}
    {windowStates.photo.open&&<AppWindow {...windowProps("photo")}><LazyPhotoEditor key={photoSourceItem?.id??"default-photo"} active={focused==="photo"&&!windowStates.photo.minimized} initialImage={photoEditorSource} onSave={savePhotoEdit}/></AppWindow>}
    {windowStates.explorer.open&&<AppWindow {...windowProps("explorer",activeFolder?.name??APP_REGISTRY.explorer.label)}><LazyFileExplorer items={items} folderId={activeFolderId} launchIntent={launchIntentFor(launchIntent,"explorer")} onLaunchHandled={handleLaunchHandled} clipboard={fileClipboard} canUndo={!!fileUndo} onNavigate={(folderId)=>{setActiveFolderId(folderId);if(folderId)updateItem(folderId,{lastOpenedAt:Date.now()})}} onOpen={openItem} onOpenWith={openItemWith} onCreateFolder={createFolder} onCreateText={createText} onRename={beginRename} onSetClipboard={setClipboard} onPaste={pasteClipboard} onFileOperation={requestFileOperation} onTrash={(ids)=>{moveManyToRecycleBin(ids);focusWindow("explorer")}} onUndo={undoFileOperation} onOpenRecycle={()=>openWindow("recycle")}/></AppWindow>}
    {windowStates.notes.open&&<AppWindow {...windowProps("notes",activeNote?.name??"记事本")}><LazyNotepadApp items={noteItems} item={activeNote} select={setActiveNoteId} create={()=>createText()} update={updateItem} remove={removeNote}/></AppWindow>}
    {windowStates.viewer.open&&<AppWindow {...windowProps("viewer",activeImage?.name??APP_REGISTRY.viewer.label)}><LazyPhotoViewerApp images={visibleItems.filter((item)=>item.type==="image")} active={activeImage} focused={focused==="viewer"&&!windowStates.viewer.minimized} open={(item)=>setActiveImageId(item.id)} clearActive={()=>setActiveImageId(null)} edit={(item)=>openItemWith(item,"photo")}/></AppWindow>}
    {windowStates.reader.open&&<AppWindow {...windowProps("reader")}><LazyReaderApp active={focused==="reader"&&!windowStates.reader.minimized} launchIntent={launchIntentFor(launchIntent,"reader")} onLaunchHandled={handleLaunchHandled} onCreateExcerpt={createReaderExcerpt}/></AppWindow>}
    {windowStates.games.open&&<AppWindow {...windowProps("games")}><LazyGameHall running={{mines:windowStates.mines.open,chess:windowStates.chess.open,gomoku:windowStates.gomoku.open,go:windowStates.go.open,sudoku:windowStates.sudoku.open,voyage:windowStates.voyage.open,tower:windowStates.tower.open}} onLaunch={openWindow}/></AppWindow>}
    {windowStates.folder.open&&activeFolder&&<AppWindow {...windowProps("folder",activeFolder.name)}><LazyFolderViewApp folder={activeFolder} items={visibleItems.filter((item)=>item.parentId===activeFolder.id)} open={openItem} createText={()=>createText(activeFolder.id)} createFolder={()=>createFolder(activeFolder.id)} goBack={()=>{if(activeFolder.parentId)setActiveFolderId(activeFolder.parentId);else closeWindow("folder")}} context={openItemMenu}/></AppWindow>}
    {windowStates.recycle.open&&<AppWindow {...windowProps("recycle")}><LazyRecycleBinApp items={trashedItems} restore={restoreMany} remove={permanentlyDeleteMany} empty={emptyRecycleBin}/></AppWindow>}
    {windowStates.mines.open&&<AppWindow {...windowProps("mines")}><LazyMinesweeperGame/></AppWindow>}
    {windowStates.chess.open&&<AppWindow {...windowProps("chess")}><LazyChessGame/></AppWindow>}
    {windowStates.gomoku.open&&<AppWindow {...windowProps("gomoku")}><LazyGomokuGame/></AppWindow>}
    {windowStates.go.open&&<AppWindow {...windowProps("go")}><LazyGoGame/></AppWindow>}
    {windowStates.sudoku.open&&<AppWindow {...windowProps("sudoku")}><LazySudokuGame active={focused==="sudoku"&&!windowStates.sudoku.minimized}/></AppWindow>}
    {windowStates.voyage.open&&<AppWindow {...windowProps("voyage")}><LazyStarVoyageGame active={focused==="voyage"&&!windowStates.voyage.minimized}/></AppWindow>}
    {windowStates.tower.open&&<AppWindow {...windowProps("tower")}><LazyMagicTowerGame active={focused==="tower"&&!windowStates.tower.minimized}/></AppWindow>}
    {windowStates.calculator.open&&<AppWindow {...windowProps("calculator")}><LazyCalculatorApp active={focused==="calculator"&&!windowStates.calculator.minimized}/></AppWindow>}
    {windowStates.drawing.open&&<AppWindow {...windowProps("drawing")}><LazyDrawingApp onSave={savePhoto}/></AppWindow>}
    {windowStates.focus.open&&<AppWindow {...windowProps("focus")}><LazyFocusClockApp active={focused==="focus"&&!windowStates.focus.minimized}/></AppWindow>}
    {windowStates.settings.open&&<AppWindow {...windowProps("settings")}><LazySettingsApp settings={settings} launchIntent={launchIntentFor(launchIntent,"settings")} onLaunchHandled={handleLaunchHandled} onChange={updateSettings}/></AppWindow>}
    {altTab&&<section className="window-switcher" role="dialog" aria-label="切换窗口">{altTab.apps.filter((app)=>windowStates[app].open).map((app)=>{const definition=APP_REGISTRY[app];return <div key={app} className={altTab.active===app?"active":""}><span className={`app-glyph ${app}-glyph`}>{definition.windowIcon??definition.icon}</span><strong>{taskbarLabel(definition)}</strong></div>})}</section>}
    {startOpen&&<StartMenu apps={appEntries} searchQuery={searchQuery} searchIndex={searchIndex} searchResults={searchResults} onSearchQueryChange={setSearchQuery} onSearchIndexChange={setSearchIndex} onRunSearchResult={runSearchResult} onClose={()=>{setStartOpen(false);setSearchQuery("");setSearchIndex(0)}}/>}
    {systemPanelOpen&&<aside className="system-panel" aria-label="日期与通知">
      <section className="calendar-panel">
        <header><strong>{calendarTitle}</strong><div><button aria-label="上个月" onClick={()=>setCalendarMonth((current)=>new Date(current.getFullYear(),current.getMonth()-1,1))}>‹</button><button aria-label="回到本月" onClick={()=>setCalendarMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>●</button><button aria-label="下个月" onClick={()=>setCalendarMonth((current)=>new Date(current.getFullYear(),current.getMonth()+1,1))}>›</button></div></header>
        <div className="calendar-weekdays">{["日","一","二","三","四","五","六"].map((day)=><span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{calendarGrid.map((day)=><span key={day.key} className={`${day.currentMonth?"":"outside"} ${day.today?"today":""}`}>{day.date}</span>)}</div>
      </section>
      <section className="notification-panel">
        <header><strong>文件活动</strong>{!!notifications.length&&<button onClick={()=>setNotifications([])}>全部清除</button>}</header>
        <div>{notifications.length?notifications.map((notification)=>{const target=notification.itemId?visibleItems.find((item)=>item.id===notification.itemId):null;return <button key={notification.id} disabled={!target} aria-label={target?`定位${target.name}`:undefined} onClick={()=>target&&launchTarget({app:"explorer",kind:"file",itemId:target.id,parentId:target.parentId})}><i>▰</i><span><strong>{notification.message}</strong><small>{new Intl.DateTimeFormat("zh-CN",{hour:"2-digit",minute:"2-digit",hour12:false}).format(notification.createdAt)}{target?" · 打开所在位置":""}</small></span></button>}):<p>暂无文件操作记录</p>}</div>
      </section>
    </aside>}
    <button className="taskbar-reveal-zone" type="button" tabIndex={-1} aria-label="显示任务栏" onPointerEnter={()=>setTaskbarRevealed(true)}/>
    <nav className="windows-taskbar" aria-label="任务栏" onPointerEnter={()=>setTaskbarRevealed(true)} onPointerLeave={()=>{setTaskbarPreview(null);if(!startOpen&&!taskbarMenu&&!systemPanelOpen)setTaskbarRevealed(false)}}><div className="taskbar-center"><button className={`start-button ${startOpen?"selected":""}`} onClick={()=>{setTaskbarPreview(null);setStartOpen(!startOpen);setSystemPanelOpen(false);setSearchQuery("");setSearchIndex(0);setContextMenu(null);setTaskbarMenu(null)}} aria-label="开始"><span><i/><i/><i/><i/></span></button>{taskbarApps.map((app)=>{const label=taskbarLabel(app),state=windowStates[app.id];return <div className="taskbar-entry" key={app.id} onPointerEnter={()=>setTaskbarPreview(app.id)} onFocusCapture={()=>setTaskbarPreview(app.id)}><button className={`task-app ${app.id==="photo"?"photo-lab-app":`${app.kind}-app`} ${state.open?"active":""} ${focused===app.id&&!state.minimized?"selected":""}`} onClick={()=>{setTaskbarPreview(null);activateFromTaskbar(app.id)}} onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();setTaskbarPreview(null);setTaskbarMenu({app:app.id,x:clamp(event.clientX-92,8,window.innerWidth-192)});setTaskbarRevealed(true)}} aria-label={`打开${label}`} title={label}><span>{app.taskbarIcon??app.icon}</span></button>{state.open&&taskbarPreview===app.id&&<aside className="taskbar-preview"><header><span className={`app-glyph ${app.id}-glyph`}>{app.windowIcon??app.icon}</span><strong>{label}</strong><button aria-label={`关闭${label}`} onClick={()=>closeWindow(app.id)}>×</button></header><div><span>{state.minimized?"已最小化":state.maximized?"已最大化":"正在运行"}</span><i className={`${app.kind}-preview-mark`}>{app.windowIcon??app.icon}</i></div></aside>}</div>})}</div><div className="taskbar-tray"><span>⌃</span><span>⌁</span><span className={notifications.length?"notification-mark active":"notification-mark"}>▰</span><button className={`taskbar-clock ${systemPanelOpen?"selected":""}`} aria-label={`打开日期与通知${notifications.length?`，${notifications.length} 条文件活动`:""}`} onClick={()=>{setSystemPanelOpen((current)=>!current);setCalendarMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1));setStartOpen(false);setTaskbarMenu(null)}}>{clock}</button></div></nav>
    {taskbarMenu&&taskbarMenuApp&&<div className="taskbar-window-menu" style={{left:taskbarMenu.x}}><strong>{taskbarLabel(taskbarMenuApp)}</strong><button onClick={()=>openWindow(taskbarMenu.app)}>切换到窗口</button>{windowStates[taskbarMenu.app].open&&<><button onClick={()=>windowStates[taskbarMenu.app].minimized?openWindow(taskbarMenu.app):minimizeWindow(taskbarMenu.app)}>{windowStates[taskbarMenu.app].minimized?"还原":"最小化"}</button><button onClick={()=>{if(windowStates[taskbarMenu.app].minimized)openWindow(taskbarMenu.app);toggleMaximizeWindow(taskbarMenu.app);setTaskbarMenu(null)}}>{windowStates[taskbarMenu.app].maximized?"还原窗口":"最大化"}</button><span/><button className="danger" onClick={()=>closeWindow(taskbarMenu.app)}>关闭窗口</button></>}</div>}
    {renameItemId&&<div className="rename-layer"><form className="rename-dialog" onSubmit={(event)=>{event.preventDefault();finishRename()}}><strong>重命名</strong><input autoFocus value={renameValue} onChange={(event)=>setRenameValue(event.target.value)} onKeyDown={(event)=>{if(event.key==="Escape")setRenameItemId(null)}}/><div><button type="button" onClick={()=>setRenameItemId(null)}>取消</button><button type="submit">确定</button></div></form></div>}
    {pendingFileOperation&&<div className="file-operation-layer"><section className="file-operation-dialog" role="dialog" aria-modal="true" aria-label="文件名称冲突"><header><span>!</span><div><strong>目标位置已有同名项目</strong><p>{pendingFileOperation.conflicts.length} 个项目需要处理</p></div></header><div className="file-conflict-list">{pendingFileOperation.conflicts.slice(0,3).map((conflict)=><div key={`${conflict.sourceId}:${conflict.targetId}`}><span>{conflict.sourceName}</span><small>将与现有项目发生冲突</small></div>)}{pendingFileOperation.conflicts.length>3&&<p>另有 {pendingFileOperation.conflicts.length-3} 个项目</p>}</div><footer><button onClick={()=>setPendingFileOperation(null)}>取消</button><button onClick={()=>performFileOperation(pendingFileOperation.mode,pendingFileOperation.ids,pendingFileOperation.parentId,"keep-both")}>保留两份</button><button className="danger" onClick={()=>performFileOperation(pendingFileOperation.mode,pendingFileOperation.ids,pendingFileOperation.parentId,"replace")}>替换</button></footer></section></div>}
    {draggingFiles&&<div className="desktop-drop-zone"><div><span>⇩</span><strong>释放以上传到桌面</strong><small>支持图片和 TXT 文本</small></div></div>}
    <PwaManager/>
    {toast&&<div className="desktop-toast" role="status" aria-live="polite">{toast}</div>}
    {booting&&<div className="boot-screen"><div className="boot-logo"><i/><i/><i/><i/></div><strong>NOVA</strong><span>正在启动超级桌面</span><div className="boot-dots"><i/><i/><i/><i/><i/></div></div>}
  </main>
}

function AppWindow({app,title,icon,minimized,maximized,snapMode,focused,zIndex,onFocus,onClose,onMinimize,onMaximize,onSnap,onUnsnap,children}:{app:WindowAppId;title:string;icon:string;minimized:boolean;maximized:boolean;snapMode?:WindowSnapMode;focused:boolean;zIndex:number;onFocus:()=>void;onClose:()=>void;onMinimize:()=>void;onMaximize:()=>void;onSnap:(mode:WindowSnapMode)=>void;onUnsnap:()=>void;children:React.ReactNode}){
  const [geometry,setGeometry]=useState<WindowGeometry|null>(()=>readWindowGeometry(app));
  const [snapPickerOpen,setSnapPickerOpen]=useState(false);
  const windowRef=useRef<HTMLElement>(null);
  const drag=useRef<{startX:number;startY:number;originX:number;originY:number;moved:boolean}|null>(null);
  const resize=useRef<{startX:number;startY:number;width:number;height:number}|null>(null);
  useLayoutEffect(()=>{const element=windowRef.current;if(!element)return;const rect=element.getBoundingClientRect();setGeometry((current)=>current?fitWindowGeometry(current):fitWindowGeometry({x:(window.innerWidth-rect.width)/2,y:(window.innerHeight-49-rect.height)/2,width:rect.width,height:rect.height}))},[]);
  useEffect(()=>{if(snapMode)setGeometry(snappedWindowGeometry(snapMode,window.innerWidth,window.innerHeight))},[snapMode]);
  useEffect(()=>{if(geometry)localStorage.setItem(`${WINDOW_GEOMETRY_PREFIX}${app}`,JSON.stringify(geometry))},[app,geometry]);
  useEffect(()=>{const element=windowRef.current;if(!element||maximized)return;const observer=new ResizeObserver(()=>{if(element.classList.contains("maximized"))return;const rect=element.getBoundingClientRect();setGeometry((current)=>{if(!current)return current;const width=Math.round(rect.width),height=Math.round(rect.height);return width===Math.round(current.width)&&height===Math.round(current.height)?current:fitWindowGeometry({...current,width,height})})});observer.observe(element);return()=>observer.disconnect()},[maximized]);
  useEffect(()=>{const resize=()=>setGeometry((current)=>snapMode?snappedWindowGeometry(snapMode,window.innerWidth,window.innerHeight):current?fitWindowGeometry(current):current);window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize)},[snapMode]);
  const startDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{if(event.button!==0||maximized||(event.target as HTMLElement).closest(".window-controls"))return;const element=windowRef.current;if(!element)return;event.preventDefault();onFocus();const rect=element.getBoundingClientRect();drag.current={startX:event.clientX,startY:event.clientY,originX:rect.left,originY:rect.top,moved:false};event.currentTarget.setPointerCapture(event.pointerId)};
  const moveDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{const current=drag.current,element=windowRef.current;if(!current||!element)return;const dx=event.clientX-current.startX,dy=event.clientY-current.startY;if(!current.moved&&Math.abs(dx)+Math.abs(dy)>3){current.moved=true;onUnsnap()}if(!current.moved)return;const rect=element.getBoundingClientRect(),x=clamp(current.originX+dx,0,Math.max(0,window.innerWidth-120)),y=clamp(current.originY+dy,0,Math.max(0,window.innerHeight-87));setGeometry((value)=>({x,y,width:value?.width??rect.width,height:value?.height??rect.height}))};
  const endDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{const current=drag.current;if(!current)return;drag.current=null;event.currentTarget.releasePointerCapture(event.pointerId);if(!current.moved)return;const snap=edgeSnapMode(event.clientX,event.clientY,window.innerWidth,window.innerHeight);if(snap==="maximize")onMaximize();else if(snap)onSnap(snap)};
  const startResize=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(maximized||event.button!==0)return;const rect=windowRef.current?.getBoundingClientRect();if(!rect)return;event.preventDefault();event.stopPropagation();onFocus();onUnsnap();resize.current={startX:event.clientX,startY:event.clientY,width:rect.width,height:rect.height};event.currentTarget.setPointerCapture(event.pointerId)};
  const moveResize=(event:ReactPointerEvent<HTMLButtonElement>)=>{const current=resize.current,element=windowRef.current;if(!current||!element)return;const rect=element.getBoundingClientRect(),width=clamp(current.width+event.clientX-current.startX,320,Math.max(320,window.innerWidth-rect.left-4)),height=clamp(current.height+event.clientY-current.startY,260,Math.max(260,window.innerHeight-49-rect.top));setGeometry((value)=>({x:value?.x??rect.left,y:value?.y??rect.top,width,height}))};
  const endResize=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!resize.current)return;resize.current=null;event.currentTarget.releasePointerCapture(event.pointerId)};
  const chooseSnap=(mode:WindowSnapMode)=>{onSnap(mode);setSnapPickerOpen(false)};
  const style:React.CSSProperties=geometry&&!maximized?{left:geometry.x,top:geometry.y,width:geometry.width,height:geometry.height,right:"auto",bottom:"auto",zIndex}:{zIndex};
  return <section ref={windowRef} className={`desktop-window ${app}-window ${minimized?"minimized":""} ${maximized?"maximized":""} ${focused?"focused":""}`} style={style} onPointerDown={onFocus}><div className="window-chrome" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={onMaximize}><div className="window-identity"><span className={`app-glyph ${app}-glyph`}>{icon}</span><strong>{title}</strong></div><div className="window-controls windows-controls"><button className="window-minimize" aria-label={`最小化${title}`} onClick={onMinimize}>—</button><div className="snap-control" onPointerEnter={()=>setSnapPickerOpen(true)} onPointerLeave={()=>setSnapPickerOpen(false)} onFocusCapture={()=>setSnapPickerOpen(true)} onBlurCapture={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setSnapPickerOpen(false)}}><button className="window-maximize" aria-label={maximized?`还原${title}`:`最大化${title}`} onClick={onMaximize}>□</button>{snapPickerOpen&&<aside className="snap-picker" aria-label="窗口贴靠布局"><strong>贴靠布局</strong><div><button aria-label="贴靠到左半屏" onClick={()=>chooseSnap("left")}><i/><i/></button><button aria-label="贴靠到右半屏" onClick={()=>chooseSnap("right")}><i/><i/></button><button aria-label="贴靠到左上角" onClick={()=>chooseSnap("top-left")}><i/><i/><i/><i/></button><button aria-label="贴靠到右上角" onClick={()=>chooseSnap("top-right")}><i/><i/><i/><i/></button><button aria-label="贴靠到左下角" onClick={()=>chooseSnap("bottom-left")}><i/><i/><i/><i/></button><button aria-label="贴靠到右下角" onClick={()=>chooseSnap("bottom-right")}><i/><i/><i/><i/></button></div></aside>}</div><button className="window-close" aria-label={`关闭${title}`} onClick={onClose}>×</button></div></div><div className="window-content"><AppLoadBoundary appName={title}>{children}</AppLoadBoundary></div>{!maximized&&<button className="window-resize-handle" aria-label={`调整${title}窗口大小`} title="拖动调整窗口大小" onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}/>}</section>
}
function useDesktopIconDrag(id:string,position:IconPosition|undefined,move:((id:string,position:IconPosition)=>void)|undefined){const drag=useRef<{x:number;y:number;origin:IconPosition}|null>(null),moved=useRef(false);const start=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!position||!move||event.button!==0)return;event.stopPropagation();drag.current={x:event.clientX,y:event.clientY,origin:position};moved.current=false;event.currentTarget.setPointerCapture(event.pointerId)};const update=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!drag.current||!move)return;const parent=event.currentTarget.parentElement?.getBoundingClientRect();if(!parent)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>3)moved.current=true;move(id,{x:clamp(drag.current.origin.x+dx,0,Math.max(0,parent.width-78)),y:clamp(drag.current.origin.y+dy,0,Math.max(0,parent.height-86))})};const end=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!drag.current)return;drag.current=null;event.currentTarget.releasePointerCapture(event.pointerId)};return{moved,start,update,end}}
function DesktopShortcut({id,label,icon,kind,position,move,open,onContextMenu}:{id:string;label:string;icon:string;kind:string;position:IconPosition;move:(id:string,position:IconPosition)=>void;open:()=>void;onContextMenu:(x:number,y:number)=>void}){const drag=useDesktopIconDrag(id,position,move);return <button className="desktop-shortcut positioned" style={{left:position.x,top:position.y}} onPointerDown={drag.start} onPointerMove={drag.update} onPointerUp={drag.end} onPointerCancel={drag.end} onDoubleClick={()=>{if(!drag.moved.current)open()}} onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();onContextMenu(event.clientX,event.clientY)}} onKeyDown={(event)=>{if(event.key==="Enter")open()}}><span className={`shortcut-icon ${kind}-shortcut`}>{icon}</span><strong>{label}</strong></button>}
function DesktopFile({item,position,move,selected,cut=false,onSelect,onOpen,onDragStart,onFileDrop,onContextMenu}:{item:DesktopItem;position?:IconPosition;move?:(id:string,position:IconPosition)=>void;selected:boolean;cut?:boolean;onSelect:(event:ReactMouseEvent<HTMLButtonElement>)=>void;onOpen:()=>void;onDragStart?:(event:ReactDragEvent<HTMLButtonElement>)=>void;onFileDrop?:(event:ReactDragEvent<HTMLButtonElement>)=>void;onContextMenu?:(x:number,y:number)=>void}){const drag=useDesktopIconDrag(item.id,position,move);return <button draggable={!!onDragStart} className={`desktop-item ${position?"positioned":""} ${selected?"selected":""} ${cut?"cut":""}`} style={position?{left:position.x,top:position.y}:undefined} onPointerDown={drag.start} onPointerMove={drag.update} onPointerUp={drag.end} onPointerCancel={drag.end} onDragStart={onDragStart} onDragOver={(event)=>{if(!onFileDrop||!event.dataTransfer.types.includes(NOVA_FILE_DRAG_TYPE))return;event.preventDefault();event.stopPropagation();event.currentTarget.classList.add("drop-target")}} onDragLeave={(event)=>event.currentTarget.classList.remove("drop-target")} onDrop={(event)=>{event.currentTarget.classList.remove("drop-target");onFileDrop?.(event)}} onClick={(event)=>{event.stopPropagation();if(!drag.moved.current)onSelect(event)}} onContextMenu={(event)=>{if(!onContextMenu)return;event.preventDefault();event.stopPropagation();onContextMenu(event.clientX,event.clientY)}} onDoubleClick={()=>{if(!drag.moved.current)onOpen()}} onKeyDown={(event)=>{if(event.key==="Enter")onOpen();if(event.shiftKey&&event.key==="F10"&&onContextMenu){event.preventDefault();const rect=event.currentTarget.getBoundingClientRect();onContextMenu(rect.left+20,rect.top+20)}}}>{item.type==="folder"?<span className="folder-icon"><i/></span>:item.type==="text"?<span className="text-icon"><b>TXT</b><i/><i/><i/></span>:<span className="image-icon" style={{backgroundImage:`url(${item.content})`}}/>}<strong>{item.name}</strong></button>}
