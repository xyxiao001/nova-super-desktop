"use client";

import { ChangeEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { openDB, type DBSchema } from "idb";
import ChessGame from "./ChessGame";
import DrawingApp from "./DrawingApp";
import GameHall, { type GameAppId } from "./GameHall";
import GoGame from "./GoGame";
import GomokuGame from "./GomokuGame";
import ReaderApp from "./ReaderApp";

type Mode = "调整" | "滤镜" | "裁剪";
type Ratio = "原始" | "自由格式" | "正方形" | "16:9" | "4:5" | "5:7" | "4:3" | "3:5" | "3:2";
type CropRect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };
type EditState = { values: Record<string, number>; filter: string; rotation: number; flipX: boolean; flipY: boolean; ratio: Ratio; crop: CropRect; redEyes: Point[] };
type Control = { label: string; key: string; min?: number; max?: number };
type DesktopItem = { id: string; type: "folder" | "text" | "image"; name: string; content: string; parentId: string | null; createdAt: number; deletedAt?: number };
type WindowAppId = "photo" | "notes" | "viewer" | "reader" | "games" | "folder" | "recycle" | GameAppId | "calculator" | "drawing";
type AppId = "desktop" | WindowAppId;
type AppDefinition = { id:WindowAppId; label:string; icon:string; kind:string; launcher:boolean; taskbarPinned:boolean; windowIcon?:string; taskbarIcon?:string };
type WindowState = { open:boolean; minimized:boolean; maximized:boolean };
type WindowStateMap = Record<WindowAppId,WindowState>;
type ContextMenuState = { x: number; y: number; itemId?: string; appKey?: WindowAppId };
type PhotoSource = { name: string; content: string };
type IconPosition = { x: number; y: number };
type MineCell = { mine:boolean; revealed:boolean; flagged:boolean; nearby:number };
type MineDifficulty = "beginner" | "intermediate" | "expert";
type WindowGeometry = { x:number; y:number; width:number; height:number };

interface NovaDesktopDatabase extends DBSchema {
  items: { key:string; value:DesktopItem };
}

const DESKTOP_STORAGE_KEY = "nova-desktop-items";
const POSITION_STORAGE_KEY = "nova-desktop-positions";
const DESKTOP_DB_NAME = "nova-desktop";
const WINDOW_GEOMETRY_PREFIX = "nova-window-geometry:";
const APP_REGISTRY:Record<WindowAppId,AppDefinition> = {
  photo:{id:"photo",label:"照片实验室",icon:"✦",kind:"photo",launcher:true,taskbarPinned:true},
  notes:{id:"notes",label:"记事本",icon:"▤",kind:"notes",launcher:true,taskbarPinned:true},
  viewer:{id:"viewer",label:"照片",icon:"▧",kind:"viewer",launcher:true,taskbarPinned:true,windowIcon:"✿"},
  reader:{id:"reader",label:"NOVA 阅读",icon:"阅",kind:"reader",launcher:true,taskbarPinned:true},
  games:{id:"games",label:"游戏大厅",icon:"",kind:"games",launcher:true,taskbarPinned:false},
  folder:{id:"folder",label:"文件夹",icon:"▱",kind:"folder",launcher:false,taskbarPinned:false},
  recycle:{id:"recycle",label:"回收站",icon:"▥",kind:"recycle",launcher:true,taskbarPinned:false,windowIcon:"▨",taskbarIcon:"▨"},
  mines:{id:"mines",label:"扫雷",icon:"✹",kind:"mines",launcher:false,taskbarPinned:false},
  chess:{id:"chess",label:"国际象棋",icon:"♞",kind:"chess",launcher:false,taskbarPinned:false},
  gomoku:{id:"gomoku",label:"五子棋",icon:"●",kind:"gomoku",launcher:false,taskbarPinned:false},
  go:{id:"go",label:"围棋",icon:"◉",kind:"go",launcher:false,taskbarPinned:false},
  calculator:{id:"calculator",label:"计算器",icon:"＋",kind:"calculator",launcher:true,taskbarPinned:false},
  drawing:{id:"drawing",label:"NOVA 画板",icon:"✎",kind:"drawing",launcher:true,taskbarPinned:false},
};
const REGISTERED_APPS=Object.values(APP_REGISTRY);
const LAUNCHER_APPS=REGISTERED_APPS.filter((app)=>app.launcher);
const createInitialWindowState=()=>Object.fromEntries(REGISTERED_APPS.map((app)=>[app.id,{open:false,minimized:false,maximized:false}])) as WindowStateMap;

const MINE_LEVELS:Record<MineDifficulty,{label:string;rows:number;columns:number;mines:number}> = {
  beginner:{label:"初级",rows:9,columns:9,mines:10},
  intermediate:{label:"中级",rows:16,columns:16,mines:40},
  expert:{label:"高级",rows:16,columns:30,mines:99},
};

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
const descendantIds = (items:DesktopItem[],roots:string[]) => {const ids=new Set(roots);let changed=true;while(changed){changed=false;for(const item of items){if(item.parentId&&ids.has(item.parentId)&&!ids.has(item.id)){ids.add(item.id);changed=true}}}return ids};
const readBrowserFile=(file:File,mode:"text"|"data")=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result??""));reader.onerror=()=>reject(reader.error);if(mode==="text")reader.readAsText(file);else reader.readAsDataURL(file)});
const openDesktopDatabase=()=>openDB<NovaDesktopDatabase>(DESKTOP_DB_NAME,1,{upgrade(database){database.createObjectStore("items",{keyPath:"id"})}});
const replaceDesktopItems=async(items:DesktopItem[])=>{const database=await openDesktopDatabase(),transaction=database.transaction("items","readwrite");await transaction.store.clear();await Promise.all(items.map((item)=>transaction.store.put(item)));await transaction.done;database.close()};
const fitWindowGeometry=(geometry:WindowGeometry):WindowGeometry=>{const width=clamp(geometry.width,320,Math.max(320,window.innerWidth-8)),height=clamp(geometry.height,260,Math.max(260,window.innerHeight-57));return{x:clamp(geometry.x,0,Math.max(0,window.innerWidth-width)),y:clamp(geometry.y,0,Math.max(0,window.innerHeight-49-height)),width,height}};
const readWindowGeometry=(app:WindowAppId)=>{const saved=localStorage.getItem(`${WINDOW_GEOMETRY_PREFIX}${app}`);return saved?fitWindowGeometry(JSON.parse(saved) as WindowGeometry):null};

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

export default function Home() {
  const [items,setItems]=useState<DesktopItem[]>([]),[positions,setPositions]=useState<Record<string,IconPosition>>({}),[storageReady,setStorageReady]=useState(false),[selectedIds,setSelectedIds]=useState<string[]>([]);
  const [windowStates,setWindowStates]=useState<WindowStateMap>(createInitialWindowState);
  const [photoSourceId,setPhotoSourceId]=useState<string|null>(null),[activeNoteId,setActiveNoteId]=useState<string|null>(null),[activeImageId,setActiveImageId]=useState<string|null>(null),[activeFolderId,setActiveFolderId]=useState<string|null>(null);
  const [focused,setFocused]=useState<AppId>("desktop"),[clock,setClock]=useState(""),[contextMenu,setContextMenu]=useState<ContextMenuState|null>(null),[startOpen,setStartOpen]=useState(false),[searchQuery,setSearchQuery]=useState(""),[toast,setToast]=useState("");
  const [renameItemId,setRenameItemId]=useState<string|null>(null),[renameValue,setRenameValue]=useState(""),[booting,setBooting]=useState(true),[draggingFiles,setDraggingFiles]=useState(false);
  const desktopUploadRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{let cancelled=false;const timer=setTimeout(()=>setBooting(false),1450);const load=async()=>{try{const database=await openDesktopDatabase();let savedItems=await database.getAll("items");const legacy=localStorage.getItem(DESKTOP_STORAGE_KEY);if(legacy&&!savedItems.length){savedItems=JSON.parse(legacy) as DesktopItem[];const transaction=database.transaction("items","readwrite");await Promise.all(savedItems.map((item)=>transaction.store.put(item)));await transaction.done}if(legacy)localStorage.removeItem(DESKTOP_STORAGE_KEY);database.close();if(!cancelled)setItems(savedItems)}catch{if(!cancelled)setToast("桌面文件读取失败")}finally{if(!cancelled){const savedPositions=localStorage.getItem(POSITION_STORAGE_KEY);setPositions(savedPositions?JSON.parse(savedPositions):{});setStorageReady(true)}}};void load();return()=>{cancelled=true;clearTimeout(timer)}},[]);
  useEffect(()=>{if(!storageReady)return;void replaceDesktopItems(items).catch(()=>setToast("桌面文件保存失败"))},[items,storageReady]);
  useEffect(()=>{if(storageReady)localStorage.setItem(POSITION_STORAGE_KEY,JSON.stringify(positions))},[positions,storageReady]);
  useEffect(()=>{const update=()=>setClock(new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()));update();const timer=setInterval(update,30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),1800);return()=>clearTimeout(timer)},[toast]);

  const updateWindow=useCallback((app:WindowAppId,patch:Partial<WindowState>)=>setWindowStates((current)=>({...current,[app]:{...current[app],...patch}})),[]);
  const openWindow=useCallback((app:WindowAppId)=>{updateWindow(app,{open:true,minimized:false});setFocused(app);setStartOpen(false);setContextMenu(null)},[updateWindow]);
  const dismissWindow=useCallback((app:WindowAppId)=>updateWindow(app,{open:false}),[updateWindow]);
  const closeWindow=useCallback((app:WindowAppId)=>{dismissWindow(app);if(app==="photo")setPhotoSourceId(null);setFocused("desktop")},[dismissWindow]);
  const minimizeWindow=useCallback((app:WindowAppId)=>updateWindow(app,{minimized:true}),[updateWindow]);
  const toggleMaximizeWindow=useCallback((app:WindowAppId)=>setWindowStates((current)=>({...current,[app]:{...current[app],maximized:!current[app].maximized}})),[]);

  const uniqueName=(base:string,extension="")=>{let index=1,name=`${base}${extension}`;while(items.some((item)=>!item.deletedAt&&item.name===name)){index+=1;name=`${base} ${index}${extension}`}return name};
  const createFolder=(parentId:string|null=null)=>{const item:DesktopItem={id:crypto.randomUUID(),type:"folder",name:uniqueName("新建文件夹"),content:"",parentId,createdAt:Date.now()};setItems((current)=>[...current,item]);setSelectedIds(parentId?[]:[item.id]);setContextMenu(null)};
  const createText=(parentId:string|null=null)=>{const item:DesktopItem={id:crypto.randomUUID(),type:"text",name:uniqueName("未命名",".txt"),content:"",parentId,createdAt:Date.now()};setItems((current)=>[...current,item]);setActiveNoteId(item.id);openWindow("notes")};
  const updateItem=(id:string,patch:Partial<DesktopItem>)=>setItems((current)=>current.map((item)=>item.id===id?{...item,...patch}:item));
  const openItem=(item:DesktopItem)=>{setSelectedIds([item.id]);if(item.type==="text"){setActiveNoteId(item.id);openWindow("notes")}if(item.type==="image"){setActiveImageId(item.id);openWindow("viewer")}if(item.type==="folder"){setActiveFolderId(item.id);openWindow("folder")}};
  const savePhoto=(name:string,content:string)=>{const dot=name.lastIndexOf("."),base=dot>0?name.slice(0,dot):name,extension=dot>0?name.slice(dot):"";const finalName=items.some((item)=>!item.deletedAt&&item.name===name)?uniqueName(base,extension):name;const item:DesktopItem={id:crypto.randomUUID(),type:"image",name:finalName,content,parentId:null,createdAt:Date.now()};setItems((current)=>[...current,item]);setToast(`${finalName} 已存储到桌面`)};
  const editPhoto=(item:DesktopItem)=>{setPhotoSourceId(item.id);openWindow("photo")};
  const downloadItem=(item:DesktopItem)=>{const link=document.createElement("a");let objectUrl="";if(item.type==="image")link.href=item.content;else{objectUrl=URL.createObjectURL(new Blob([item.content],{type:"text/plain;charset=utf-8"}));link.href=objectUrl}link.download=item.name;link.click();if(objectUrl)setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);setContextMenu(null)};
  const closeAffected=(ids:Set<string>)=>{if(activeImageId&&ids.has(activeImageId)){setActiveImageId(null);dismissWindow("viewer")}if(activeNoteId&&ids.has(activeNoteId)){setActiveNoteId(null);dismissWindow("notes")}if(activeFolderId&&ids.has(activeFolderId)){setActiveFolderId(null);dismissWindow("folder")}if(photoSourceId&&ids.has(photoSourceId)){setPhotoSourceId(null);dismissWindow("photo")}};
  const moveManyToRecycleBin=(ids:string[])=>{const affected=descendantIds(items,ids),now=Date.now();setItems((current)=>current.map((entry)=>ids.includes(entry.id)?{...entry,deletedAt:now}:entry));closeAffected(affected);setSelectedIds([]);setContextMenu(null);setFocused("desktop");setToast(`${ids.length} 个项目已移到回收站`)};
  const restoreItem=(item:DesktopItem)=>{setItems((current)=>current.map((entry)=>entry.id===item.id?{...entry,deletedAt:undefined}:entry));setToast(`${item.name} 已还原到桌面`)};
  const permanentlyDeleteMany=(ids:string[])=>{const removed=descendantIds(items,ids);setItems((current)=>current.filter((entry)=>!removed.has(entry.id)));closeAffected(removed);setSelectedIds([]);setContextMenu(null);setToast(`${ids.length} 个项目已永久删除`)};
  const permanentlyDelete=(item:DesktopItem)=>permanentlyDeleteMany([item.id]);
  const emptyRecycleBin=()=>{setItems((current)=>{const removed=descendantIds(current,current.filter((item)=>item.deletedAt).map((item)=>item.id));return current.filter((item)=>!removed.has(item.id))});setToast("回收站已清空")};
  const launchApp=(app:WindowAppId)=>{if(app==="notes"){if(activeNoteId&&items.some((item)=>item.id===activeNoteId))openWindow("notes");else createText();return}if(app==="viewer"&&!windowStates.viewer.open)setActiveImageId(null);openWindow(app)};
  const activeNote=items.find((item)=>!item.deletedAt&&item.id===activeNoteId&&item.type==="text")??null;
  const activeImage=items.find((item)=>!item.deletedAt&&item.id===activeImageId&&item.type==="image")??null;
  const activeFolder=items.find((item)=>!item.deletedAt&&item.id===activeFolderId&&item.type==="folder")??null;
  const photoSourceItem=items.find((item)=>!item.deletedAt&&item.id===photoSourceId&&item.type==="image")??null;
  const contextItem=contextMenu?.itemId?items.find((item)=>!item.deletedAt&&item.id===contextMenu.itemId)??null:null;
  const rootItems=items.filter((item)=>!item.deletedAt&&item.parentId===null);
  const trashedItems=items.filter((item)=>item.deletedAt);
  const appEntries=LAUNCHER_APPS.map((app)=>({...app,key:app.id,icon:app.id==="recycle"&&trashedItems.length?"▨":app.icon,open:()=>launchApp(app.id)}));
  const contextApp=contextMenu?.appKey?appEntries.find((app)=>app.key===contextMenu.appKey)??null:null;
  const contextTargets=contextItem?(selectedIds.includes(contextItem.id)?items.filter((item)=>selectedIds.includes(item.id)&&!item.deletedAt):[contextItem]):[];
  const searchText=searchQuery.trim().toLowerCase(),searchApps=searchText?appEntries.filter((app)=>app.label.toLowerCase().includes(searchText)):[],searchItems=searchText?items.filter((item)=>!item.deletedAt&&(item.name.toLowerCase().includes(searchText)||(item.type==="text"&&item.content.toLowerCase().includes(searchText)))):[];
  const windowProps=(app:WindowAppId,title=APP_REGISTRY[app].label)=>{const definition=APP_REGISTRY[app],state=windowStates[app];return{app,title,icon:definition.windowIcon??definition.icon,minimized:state.minimized,maximized:state.maximized,focused:focused===app,onFocus:()=>setFocused(app),onClose:()=>closeWindow(app),onMinimize:()=>minimizeWindow(app),onMaximize:()=>toggleMaximizeWindow(app)}};
  const taskbarApps=REGISTERED_APPS.filter((app)=>(app.taskbarPinned||windowStates[app.id].open)&&(app.id!=="folder"||activeFolder));
  const taskbarLabel=(app:AppDefinition)=>app.id==="folder"&&activeFolder?activeFolder.name:app.label;
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
  const importFiles=async(fileList:FileList|File[])=>{const files=Array.from(fileList),accepted=files.filter((file)=>file.type.startsWith("image/")||file.type==="text/plain"||file.name.toLowerCase().endsWith(".txt"));if(!accepted.length){setToast("暂时只支持图片和 TXT 文件");setDraggingFiles(false);return}const records=await Promise.all(accepted.map(async(file)=>({type:(file.type.startsWith("image/")?"image":"text") as DesktopItem["type"],name:file.name,content:await readBrowserFile(file,file.type.startsWith("image/")?"data":"text")})));setItems((current)=>{const next=[...current];for(const record of records){const dot=record.name.lastIndexOf("."),base=dot>0?record.name.slice(0,dot):record.name,extension=dot>0?record.name.slice(dot):"";let name=record.name,index=2;while(next.some((item)=>!item.deletedAt&&item.name===name)){name=`${base} ${index}${extension}`;index++}next.push({id:crypto.randomUUID(),type:record.type,name,content:record.content,parentId:null,createdAt:Date.now()})}return next});setDraggingFiles(false);setToast(`${records.length} 个文件已上传到桌面`)};
  const selectItem=(id:string,event:ReactMouseEvent)=>{setFocused("desktop");if(event.ctrlKey||event.metaKey||event.shiftKey)setSelectedIds((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);else setSelectedIds([id])};
  const openItemMenu=(item:DesktopItem,x:number,y:number)=>{if(!selectedIds.includes(item.id))setSelectedIds([item.id]);setContextMenu({x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-235),itemId:item.id});setStartOpen(false)};
  const beginRename=(item:DesktopItem)=>{setRenameItemId(item.id);setRenameValue(item.name);setContextMenu(null)};
  const finishRename=()=>{if(renameItemId&&renameValue.trim())updateItem(renameItemId,{name:renameValue.trim()});setRenameItemId(null)};
  const arrangeIcons=(mode:"name"|"type"|"clean")=>{const entries=[...appEntries.map((app)=>({id:`app:${app.key}`,label:app.label,type:"app"})),...rootItems.map((item)=>({id:item.id,label:item.name,type:item.type}))];if(mode==="name")entries.sort((a,b)=>a.label.localeCompare(b.label,"zh-CN"));if(mode==="type")entries.sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label,"zh-CN"));const rows=Math.max(1,Math.floor((window.innerHeight-78)/90));setPositions((current)=>({...current,...Object.fromEntries(entries.map((entry,index)=>[entry.id,{x:Math.floor(index/rows)*89,y:index%rows*90}]))}));setContextMenu(null);setToast(mode==="clean"?"桌面图标已整理":mode==="name"?"已按名称排序":"已按类型排序")};

  useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{const command=event.ctrlKey||event.metaKey,key=event.key.toLowerCase(),target=event.target as HTMLElement,typing=target.matches("input,textarea,[contenteditable=true]");if(command&&key==="w"){event.preventDefault();if(focused!=="desktop")closeWindow(focused);setContextMenu(null);setStartOpen(false);setSearchQuery("");return}if(typing&&!(focused==="notes"&&command&&(key==="s"||key==="n")))return;if(command&&key==="s"&&focused==="notes"&&activeNote){event.preventDefault();setToast(`${activeNote.name} 已保存到桌面`);return}if(command&&key==="n"&&focused==="notes"){event.preventDefault();createText();return}if(command&&key==="a"&&focused==="desktop"){event.preventDefault();setSelectedIds(rootItems.map((item)=>item.id));return}if(event.shiftKey&&event.key==="F10"&&focused==="desktop"&&!selectedIds.length){event.preventDefault();setContextMenu({x:48,y:48});setStartOpen(false);return}if(event.key==="F2"&&focused==="desktop"&&selectedIds.length===1){const item=items.find((entry)=>entry.id===selectedIds[0]);if(item){event.preventDefault();beginRename(item)}return}if(event.key==="Delete"&&focused==="desktop"&&selectedIds.length){event.preventDefault();moveManyToRecycleBin(selectedIds);return}if(event.altKey&&event.key==="F4"){event.preventDefault();if(focused!=="desktop")closeWindow(focused);return}if(event.key==="Escape"&&(contextMenu||startOpen)){event.preventDefault();setContextMenu(null);setStartOpen(false);setSearchQuery("")}};window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut)},[activeNote,closeWindow,contextMenu,focused,items,selectedIds,startOpen]);
  return <main className="super-desktop windows-desktop" onPointerDown={(event)=>{if(!(event.target as HTMLElement).closest(".desktop-item,.desktop-shortcut,.rename-dialog"))setSelectedIds([]);if(!(event.target as HTMLElement).closest(".desktop-menu"))setContextMenu(null);if(!(event.target as HTMLElement).closest(".start-menu,.start-button")){setStartOpen(false);setSearchQuery("")}}} onContextMenu={(event)=>{if((event.target as HTMLElement).closest(".desktop-window,.windows-taskbar,.desktop-item,.desktop-shortcut"))return;event.preventDefault();setContextMenu({x:Math.min(event.clientX,window.innerWidth-225),y:Math.min(event.clientY,window.innerHeight-250)});setFocused("desktop");setStartOpen(false)}} onDragOver={(event)=>{if((event.target as HTMLElement).closest(".desktop-window"))return;event.preventDefault();event.dataTransfer.dropEffect="copy";setDraggingFiles(true)}} onDragLeave={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDraggingFiles(false)}} onDrop={(event)=>{if((event.target as HTMLElement).closest(".desktop-window"))return;event.preventDefault();importFiles(event.dataTransfer.files)}}>
    <input ref={desktopUploadRef} className="desktop-upload-input" aria-label="上传桌面文件" type="file" accept="image/*,.txt,text/plain" multiple onChange={(event)=>{if(event.target.files?.length)importFiles(event.target.files);event.target.value=""}}/>
    <div className="windows-wallpaper"><i/><i/><i/></div>
    <section className="desktop-files" aria-label="桌面图标">{appEntries.map((app,index)=><DesktopShortcut key={app.key} id={`app:${app.key}`} label={app.label} icon={app.icon} kind={app.kind} position={positionFor(`app:${app.key}`,index)} move={moveIcon} open={app.open} onContextMenu={(x,y)=>{setContextMenu({x:Math.min(x,window.innerWidth-225),y:Math.min(y,window.innerHeight-100),appKey:app.key});setStartOpen(false)}}/>)}{rootItems.map((item,index)=><DesktopFile key={item.id} item={item} position={positionFor(item.id,appEntries.length+index)} move={moveIcon} selected={selectedIds.includes(item.id)} onSelect={(event)=>selectItem(item.id,event)} onOpen={()=>openItem(item)} onContextMenu={(x,y)=>openItemMenu(item,x,y)}/>)}</section>
    {contextMenu&&<div className="desktop-menu" style={{left:contextMenu.x,top:contextMenu.y}}>{contextApp?<button onClick={contextApp.open}>打开 {contextApp.label}</button>:contextItem?<>{contextTargets.length===1?<><button onClick={()=>openItem(contextItem)}>打开</button><button onClick={()=>beginRename(contextItem)}>重命名</button>{contextItem.type==="folder"&&<><button onClick={()=>createFolder(contextItem.id)}>在文件夹中新建文件夹</button><button onClick={()=>createText(contextItem.id)}>在文件夹中新建文本</button></>}{contextItem.type==="image"&&<button onClick={()=>editPhoto(contextItem)}>在照片实验室中编辑</button>}{contextItem.type!=="folder"&&<button onClick={()=>downloadItem(contextItem)}>保存到下载</button>}<span/></>:<p className="menu-summary">已选择 {contextTargets.length} 个项目</p>}<button className="danger" onClick={()=>moveManyToRecycleBin(contextTargets.map((item)=>item.id))}>移到回收站</button><button className="danger" onClick={()=>permanentlyDeleteMany(contextTargets.map((item)=>item.id))}>直接删除</button></>:<><button onClick={()=>createFolder()}>新建文件夹</button><button onClick={()=>createText()}>新建文本文稿</button><button onClick={()=>{desktopUploadRef.current?.click();setContextMenu(null)}}>上传图片或 TXT</button><span/><button onClick={()=>arrangeIcons("name")}>按名称排序</button><button onClick={()=>arrangeIcons("type")}>按类型排序</button><button onClick={()=>arrangeIcons("clean")}>整理图标</button></>}</div>}
    {windowStates.photo.open&&<AppWindow {...windowProps("photo")}><PhotoEditor key={photoSourceItem?.id??"default-photo"} active={focused==="photo"&&!windowStates.photo.minimized} initialImage={photoSourceItem?{name:photoSourceItem.name.replace(/\.[^.]+$/,"")||"照片",content:photoSourceItem.content}:null} onSaveToDesktop={savePhoto}/></AppWindow>}
    {windowStates.notes.open&&activeNote&&<AppWindow {...windowProps("notes",activeNote.name)}><Notepad item={activeNote} update={updateItem}/></AppWindow>}
    {windowStates.viewer.open&&<AppWindow {...windowProps("viewer",activeImage?.name??APP_REGISTRY.viewer.label)}><PhotoViewer images={items.filter((item)=>!item.deletedAt&&item.type==="image")} active={activeImage} open={(item)=>setActiveImageId(item.id)}/></AppWindow>}
    {windowStates.reader.open&&<AppWindow {...windowProps("reader")}><ReaderApp active={focused==="reader"&&!windowStates.reader.minimized}/></AppWindow>}
    {windowStates.games.open&&<AppWindow {...windowProps("games")}><GameHall running={{mines:windowStates.mines.open,chess:windowStates.chess.open,gomoku:windowStates.gomoku.open,go:windowStates.go.open}} onLaunch={openWindow}/></AppWindow>}
    {windowStates.folder.open&&activeFolder&&<AppWindow {...windowProps("folder",activeFolder.name)}><FolderView folder={activeFolder} items={items.filter((item)=>!item.deletedAt&&item.parentId===activeFolder.id)} open={openItem} createText={()=>createText(activeFolder.id)} createFolder={()=>createFolder(activeFolder.id)} goBack={()=>{if(activeFolder.parentId)setActiveFolderId(activeFolder.parentId);else closeWindow("folder")}} context={openItemMenu}/></AppWindow>}
    {windowStates.recycle.open&&<AppWindow {...windowProps("recycle")}><RecycleBin items={trashedItems} restore={restoreItem} remove={permanentlyDelete} empty={emptyRecycleBin}/></AppWindow>}
    {windowStates.mines.open&&<AppWindow {...windowProps("mines")}><Minesweeper/></AppWindow>}
    {windowStates.chess.open&&<AppWindow {...windowProps("chess")}><ChessGame/></AppWindow>}
    {windowStates.gomoku.open&&<AppWindow {...windowProps("gomoku")}><GomokuGame/></AppWindow>}
    {windowStates.go.open&&<AppWindow {...windowProps("go")}><GoGame/></AppWindow>}
    {windowStates.calculator.open&&<AppWindow {...windowProps("calculator")}><Calculator/></AppWindow>}
    {windowStates.drawing.open&&<AppWindow {...windowProps("drawing")}><DrawingApp onSave={savePhoto}/></AppWindow>}
    {startOpen&&<section className="start-menu"><label className="start-search">⌕ <input autoFocus value={searchQuery} onChange={(event)=>setSearchQuery(event.target.value)} placeholder="搜索应用和文件"/></label>{searchText?<div className="start-results"><header><strong>搜索结果</strong><span>{searchApps.length+searchItems.length} 项</span></header>{[...searchApps.map((app)=>({key:`app:${app.key}`,label:app.label,icon:app.icon,detail:"应用",open:app.open})),...searchItems.map((item)=>({key:item.id,label:item.name,icon:item.type==="folder"?"▱":item.type==="image"?"▧":"TXT",detail:item.type==="folder"?"文件夹":item.type==="image"?"照片":"文本文稿",open:()=>openItem(item)}))].map((result)=><button key={result.key} onClick={result.open}><i>{result.icon}</i><span><strong>{result.label}</strong><small>{result.detail}</small></span></button>)}{!searchApps.length&&!searchItems.length&&<p>没有找到“{searchQuery}”</p>}</div>:<><header><strong>已固定</strong><span>所有应用</span></header><div className="start-apps">{appEntries.map((app)=><button key={app.key} onClick={app.open}><i className={`start-${app.kind}`}>{app.icon}</i><span>{app.label}</span></button>)}</div></>}<footer><span>◉</span><strong>NOVA 用户</strong><button onClick={()=>{setStartOpen(false);setSearchQuery("")}}>⏻</button></footer></section>}
    <nav className="windows-taskbar" aria-label="任务栏"><div className="taskbar-center"><button className={`start-button ${startOpen?"selected":""}`} onClick={()=>{setStartOpen(!startOpen);setSearchQuery("");setContextMenu(null)}} aria-label="开始"><span><i/><i/><i/><i/></span></button>{taskbarApps.map((app)=>{const label=taskbarLabel(app);return <button key={app.id} className={`task-app ${app.id==="photo"?"photo-lab-app":`${app.kind}-app`} ${windowStates[app.id].open?"active":""}`} onClick={()=>launchApp(app.id)} aria-label={`打开${label}`}><span>{app.taskbarIcon??app.icon}</span><small>{label}</small></button>})}</div><div className="taskbar-tray"><span>⌃</span><span>⌁</span><span>▰</span><b>{clock}</b></div></nav>
    {renameItemId&&<div className="rename-layer"><form className="rename-dialog" onSubmit={(event)=>{event.preventDefault();finishRename()}}><strong>重命名</strong><input autoFocus value={renameValue} onChange={(event)=>setRenameValue(event.target.value)} onKeyDown={(event)=>{if(event.key==="Escape")setRenameItemId(null)}}/><div><button type="button" onClick={()=>setRenameItemId(null)}>取消</button><button type="submit">确定</button></div></form></div>}
    {draggingFiles&&<div className="desktop-drop-zone"><div><span>⇩</span><strong>释放以上传到桌面</strong><small>支持图片和 TXT 文本</small></div></div>}
    {toast&&<div className="desktop-toast">{toast}</div>}
    {booting&&<div className="boot-screen"><div className="boot-logo"><i/><i/><i/><i/></div><strong>NOVA</strong><span>正在启动超级桌面</span><div className="boot-dots"><i/><i/><i/><i/><i/></div></div>}
  </main>
}

function AppWindow({app,title,icon,minimized,maximized,focused,onFocus,onClose,onMinimize,onMaximize,children}:{app:WindowAppId;title:string;icon:string;minimized:boolean;maximized:boolean;focused:boolean;onFocus:()=>void;onClose:()=>void;onMinimize:()=>void;onMaximize:()=>void;children:React.ReactNode}){
  const [geometry,setGeometry]=useState<WindowGeometry|null>(()=>readWindowGeometry(app));
  const windowRef=useRef<HTMLElement>(null);
  const drag=useRef<{startX:number;startY:number;originX:number;originY:number}|null>(null);
  const resize=useRef<{startX:number;startY:number;width:number;height:number}|null>(null);
  useLayoutEffect(()=>{const element=windowRef.current;if(!element)return;const rect=element.getBoundingClientRect();setGeometry((current)=>current?fitWindowGeometry(current):fitWindowGeometry({x:(window.innerWidth-rect.width)/2,y:(window.innerHeight-49-rect.height)/2,width:rect.width,height:rect.height}))},[]);
  useEffect(()=>{if(geometry)localStorage.setItem(`${WINDOW_GEOMETRY_PREFIX}${app}`,JSON.stringify(geometry))},[app,geometry]);
  useEffect(()=>{const element=windowRef.current;if(!element||maximized)return;const observer=new ResizeObserver(()=>{if(element.classList.contains("maximized"))return;const rect=element.getBoundingClientRect();setGeometry((current)=>{if(!current)return current;const width=Math.round(rect.width),height=Math.round(rect.height);return width===Math.round(current.width)&&height===Math.round(current.height)?current:fitWindowGeometry({...current,width,height})})});observer.observe(element);return()=>observer.disconnect()},[maximized]);
  useEffect(()=>{const resize=()=>setGeometry((current)=>current?fitWindowGeometry(current):current);window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize)},[]);
  const startDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{if(event.button!==0||maximized||(event.target as HTMLElement).closest(".window-controls"))return;const element=windowRef.current;if(!element)return;event.preventDefault();onFocus();const rect=element.getBoundingClientRect();drag.current={startX:event.clientX,startY:event.clientY,originX:rect.left,originY:rect.top};event.currentTarget.setPointerCapture(event.pointerId)};
  const moveDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{const current=drag.current,element=windowRef.current;if(!current||!element)return;const rect=element.getBoundingClientRect(),x=clamp(current.originX+event.clientX-current.startX,0,Math.max(0,window.innerWidth-120)),y=clamp(current.originY+event.clientY-current.startY,0,Math.max(0,window.innerHeight-87));setGeometry((value)=>({x,y,width:value?.width??rect.width,height:value?.height??rect.height}))};
  const endDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{if(!drag.current)return;drag.current=null;event.currentTarget.releasePointerCapture(event.pointerId)};
  const startResize=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(maximized||event.button!==0)return;const rect=windowRef.current?.getBoundingClientRect();if(!rect)return;event.preventDefault();event.stopPropagation();onFocus();resize.current={startX:event.clientX,startY:event.clientY,width:rect.width,height:rect.height};event.currentTarget.setPointerCapture(event.pointerId)};
  const moveResize=(event:ReactPointerEvent<HTMLButtonElement>)=>{const current=resize.current,element=windowRef.current;if(!current||!element)return;const rect=element.getBoundingClientRect(),width=clamp(current.width+event.clientX-current.startX,320,Math.max(320,window.innerWidth-rect.left-4)),height=clamp(current.height+event.clientY-current.startY,260,Math.max(260,window.innerHeight-49-rect.top));setGeometry((value)=>({x:value?.x??rect.left,y:value?.y??rect.top,width,height}))};
  const endResize=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!resize.current)return;resize.current=null;event.currentTarget.releasePointerCapture(event.pointerId)};
  const style=geometry&&!maximized?{left:geometry.x,top:geometry.y,width:geometry.width,height:geometry.height,right:"auto",bottom:"auto"}:undefined;
  return <section ref={windowRef} className={`desktop-window ${app}-window ${minimized?"minimized":""} ${maximized?"maximized":""} ${focused?"focused":""}`} style={style} onPointerDown={onFocus}><div className="window-chrome" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={onMaximize}><div className="window-identity"><span className={`app-glyph ${app}-glyph`}>{icon}</span><strong>{title}</strong></div><div className="window-controls windows-controls"><button aria-label={`最小化${title}`} onClick={onMinimize}>—</button><button aria-label={maximized?`还原${title}`:`最大化${title}`} onClick={onMaximize}>□</button><button aria-label={`关闭${title}`} onClick={onClose}>×</button></div></div><div className="window-content">{children}</div>{!maximized&&<button className="window-resize-handle" aria-label={`调整${title}窗口大小`} title="拖动调整窗口大小" onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}/>}</section>
}
function useDesktopIconDrag(id:string,position:IconPosition|undefined,move:((id:string,position:IconPosition)=>void)|undefined){const drag=useRef<{x:number;y:number;origin:IconPosition}|null>(null),moved=useRef(false);const start=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!position||!move||event.button!==0)return;event.stopPropagation();drag.current={x:event.clientX,y:event.clientY,origin:position};moved.current=false;event.currentTarget.setPointerCapture(event.pointerId)};const update=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!drag.current||!move)return;const parent=event.currentTarget.parentElement?.getBoundingClientRect();if(!parent)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>3)moved.current=true;move(id,{x:clamp(drag.current.origin.x+dx,0,Math.max(0,parent.width-78)),y:clamp(drag.current.origin.y+dy,0,Math.max(0,parent.height-86))})};const end=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!drag.current)return;drag.current=null;event.currentTarget.releasePointerCapture(event.pointerId)};return{moved,start,update,end}}
function DesktopShortcut({id,label,icon,kind,position,move,open,onContextMenu}:{id:string;label:string;icon:string;kind:string;position:IconPosition;move:(id:string,position:IconPosition)=>void;open:()=>void;onContextMenu:(x:number,y:number)=>void}){const drag=useDesktopIconDrag(id,position,move);return <button className="desktop-shortcut positioned" style={{left:position.x,top:position.y}} onPointerDown={drag.start} onPointerMove={drag.update} onPointerUp={drag.end} onPointerCancel={drag.end} onDoubleClick={()=>{if(!drag.moved.current)open()}} onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();onContextMenu(event.clientX,event.clientY)}} onKeyDown={(event)=>{if(event.key==="Enter")open()}}><span className={`shortcut-icon ${kind}-shortcut`}>{icon}</span><strong>{label}</strong></button>}
function DesktopFile({item,position,move,selected,onSelect,onOpen,onContextMenu}:{item:DesktopItem;position?:IconPosition;move?:(id:string,position:IconPosition)=>void;selected:boolean;onSelect:(event:ReactMouseEvent<HTMLButtonElement>)=>void;onOpen:()=>void;onContextMenu?:(x:number,y:number)=>void}){const drag=useDesktopIconDrag(item.id,position,move);return <button className={`desktop-item ${position?"positioned":""} ${selected?"selected":""}`} style={position?{left:position.x,top:position.y}:undefined} onPointerDown={drag.start} onPointerMove={drag.update} onPointerUp={drag.end} onPointerCancel={drag.end} onClick={(event)=>{event.stopPropagation();if(!drag.moved.current)onSelect(event)}} onContextMenu={(event)=>{if(!onContextMenu)return;event.preventDefault();event.stopPropagation();onContextMenu(event.clientX,event.clientY)}} onDoubleClick={()=>{if(!drag.moved.current)onOpen()}} onKeyDown={(event)=>{if(event.key==="Enter")onOpen();if(event.shiftKey&&event.key==="F10"&&onContextMenu){event.preventDefault();const rect=event.currentTarget.getBoundingClientRect();onContextMenu(rect.left+20,rect.top+20)}}}>{item.type==="folder"?<span className="folder-icon"><i/></span>:item.type==="text"?<span className="text-icon"><b>TXT</b><i/><i/><i/></span>:<span className="image-icon" style={{backgroundImage:`url(${item.content})`}}/>}<strong>{item.name}</strong></button>}
function Notepad({item,update}:{item:DesktopItem;update:(id:string,patch:Partial<DesktopItem>)=>void}){return <div className="notepad-app"><header><input aria-label="文件名" value={item.name} onChange={(event)=>update(item.id,{name:event.target.value})}/><span>已自动保存到桌面 · Ctrl+S 保存</span></header><textarea aria-label="文本内容" autoFocus value={item.content} onChange={(event)=>update(item.id,{content:event.target.value})} placeholder="开始输入…"/></div>}
function PhotoViewer({images,active,open}:{images:DesktopItem[];active:DesktopItem|null;open:(item:DesktopItem)=>void}){return <div className="photo-viewer">{active?<><img src={active.content} alt={active.name}/><footer><strong>{active.name}</strong><span>存储在桌面</span></footer></>:images.length?<div className="photo-library">{images.map((image)=><button key={image.id} onDoubleClick={()=>open(image)} onClick={()=>open(image)}><img src={image.content} alt={image.name}/><span>{image.name}</span></button>)}</div>:<div className="app-empty"><span>✿</span><strong>桌面上还没有照片</strong><small>在照片实验室中完成编辑后，图片会出现在这里。</small></div>}</div>}
function FolderView({folder,items,open,createText,createFolder,goBack,context}:{folder:DesktopItem;items:DesktopItem[];open:(item:DesktopItem)=>void;createText:()=>void;createFolder:()=>void;goBack:()=>void;context:(item:DesktopItem,x:number,y:number)=>void}){return <div className="folder-view"><header><div><button aria-label="返回上一级" onClick={goBack}>←</button><strong>{folder.name}</strong><button onClick={createFolder}>＋ 新建文件夹</button><button onClick={createText}>＋ 新建文本</button></div><span>{items.length} 个项目</span></header>{items.length?<div className="folder-items">{items.map((item)=><DesktopFile key={item.id} item={item} selected={false} onSelect={()=>{}} onOpen={()=>open(item)} onContextMenu={(x,y)=>context(item,x,y)}/>)}</div>:<div className="app-empty"><span>▱</span><strong>{folder.name}是空的</strong><small>可以继续新建文件夹或文本文稿。</small></div>}</div>}

function RecycleBin({items,restore,remove,empty}:{items:DesktopItem[];restore:(item:DesktopItem)=>void;remove:(item:DesktopItem)=>void;empty:()=>void}){const format=(value?:number)=>value?new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value)):"";return <div className="recycle-bin"><header><div><strong>回收站</strong><span>{items.length} 个项目</span></div><button disabled={!items.length} onClick={empty}>清空回收站</button></header>{items.length?<div className="recycle-list">{items.map((item)=><article key={item.id}><span className={`recycle-file-icon ${item.type}`}>{item.type==="image"?<i style={{backgroundImage:`url(${item.content})`}}/>:item.type==="folder"?"▱":"TXT"}</span><div><strong>{item.name}</strong><small>删除时间：{format(item.deletedAt)}</small></div><button onClick={()=>restore(item)}>还原</button><button className="permanent-delete" onClick={()=>remove(item)}>永久删除</button></article>)}</div>:<div className="app-empty"><span>▥</span><strong>回收站为空</strong><small>从桌面删除的文件会暂时保存在这里。</small></div>}</div>}

function mineNeighbors(index:number,rows:number,columns:number){const row=Math.floor(index/columns),column=index%columns,neighbors:number[]=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const nextRow=row+y,nextColumn=column+x;if((x||y)&&nextRow>=0&&nextRow<rows&&nextColumn>=0&&nextColumn<columns)neighbors.push(nextRow*columns+nextColumn)}return neighbors}
function makeMineBoard(level:MineDifficulty,safeIndex?:number,seed=1):MineCell[]{const config=MINE_LEVELS[level],length=config.rows*config.columns,empty=Array.from({length},()=>({mine:false,revealed:false,flagged:false,nearby:0}));if(safeIndex===undefined)return empty;let value=seed||1;const random=()=>{value=(value*1664525+1013904223)%4294967296;return value/4294967296},excluded=new Set([safeIndex,...mineNeighbors(safeIndex,config.rows,config.columns)]),candidates=Array.from({length},(_,index)=>index).filter((index)=>!excluded.has(index));for(let index=candidates.length-1;index>0;index--){const target=Math.floor(random()*(index+1));[candidates[index],candidates[target]]=[candidates[target],candidates[index]]}const mines=new Set(candidates.slice(0,config.mines));return empty.map((cell,index)=>({...cell,mine:mines.has(index),nearby:mineNeighbors(index,config.rows,config.columns).filter((neighbor)=>mines.has(neighbor)).length}))}
function Minesweeper(){
  const [difficulty,setDifficulty]=useState<MineDifficulty>(()=>(localStorage.getItem("nova-mines-difficulty") as MineDifficulty)||"beginner");
  const [board,setBoard]=useState(()=>makeMineBoard(difficulty));
  const [status,setStatus]=useState<"ready"|"playing"|"won"|"lost">("ready");
  const [startedAt,setStartedAt]=useState<number|null>(null);
  const [elapsed,setElapsed]=useState(0);
  const [bestTimes,setBestTimes]=useState<Partial<Record<MineDifficulty,number>>>(()=>{const saved=localStorage.getItem("nova-mines-best");return saved?JSON.parse(saved):{}});
  const config=MINE_LEVELS[difficulty],flags=board.filter((cell)=>cell.flagged).length;

  useEffect(()=>{if(status!=="playing"||!startedAt)return;const tick=()=>setElapsed(Math.min(999,Math.floor((Date.now()-startedAt)/1000))),timer=setInterval(tick,250);tick();return()=>clearInterval(timer)},[startedAt,status]);

  const reset=(level=difficulty)=>{setDifficulty(level);localStorage.setItem("nova-mines-difficulty",level);setBoard(makeMineBoard(level));setStatus("ready");setStartedAt(null);setElapsed(0)};
  const finish=(next:MineCell[],start:number)=>{
    if(next.some((cell)=>cell.mine&&cell.revealed)){for(const cell of next)if(cell.mine)cell.revealed=true;setStatus("lost");setStartedAt(null);setBoard(next);return}
    if(next.every((cell)=>cell.mine||cell.revealed)){for(const cell of next)if(cell.mine)cell.flagged=true;const time=Math.min(999,Math.floor((Date.now()-start)/1000)),best=bestTimes[difficulty];setElapsed(time);setStartedAt(null);setStatus("won");setBoard(next);if(best===undefined||time<best){const updated={...bestTimes,[difficulty]:time};setBestTimes(updated);localStorage.setItem("nova-mines-best",JSON.stringify(updated))}return}
    setBoard(next);
  };
  const revealTargets=(targets:number[])=>{
    if(status==="won"||status==="lost")return;
    const start=startedAt??Date.now(),next=(status==="ready"?makeMineBoard(difficulty,targets[0],start):board).map((cell,index)=>({...cell,flagged:board[index]?.flagged??false})),queue=[...targets],seen=new Set<number>();
    if(status==="ready"){setStartedAt(start);setStatus("playing")}
    while(queue.length){const current=queue.shift()!;if(seen.has(current))continue;seen.add(current);const cell=next[current];if(!cell||cell.flagged||cell.revealed)continue;cell.revealed=true;if(cell.mine)break;if(cell.nearby===0)queue.push(...mineNeighbors(current,config.rows,config.columns))}
    finish(next,start);
  };
  const reveal=(index:number)=>{if(!board[index].flagged&&!board[index].revealed)revealTargets([index])};
  const chord=(index:number)=>{const cell=board[index];if(status!=="playing"||!cell.revealed||!cell.nearby)return;const neighbors=mineNeighbors(index,config.rows,config.columns);if(neighbors.filter((neighbor)=>board[neighbor].flagged).length===cell.nearby)revealTargets(neighbors.filter((neighbor)=>!board[neighbor].flagged))};
  const flag=(event:ReactMouseEvent,index:number)=>{event.preventDefault();if(status==="won"||status==="lost"||board[index].revealed)return;setBoard((current)=>current.map((cell,cellIndex)=>cellIndex===index&&(!cell.flagged&&flags>=config.mines)?cell:cellIndex===index?{...cell,flagged:!cell.flagged}:cell))};
  const face=status==="won"?"😎":status==="lost"?"😵":status==="playing"?"🙂":"😊",statusText=status==="won"?"雷区已清除":status==="lost"?"本局结束":status==="playing"?"进行中":"准备开始";
  return <div className="minesweeper">
    <nav className="mine-difficulties" aria-label="扫雷难度">{(Object.keys(MINE_LEVELS) as MineDifficulty[]).map((level)=><button key={level} className={difficulty===level?"active":""} aria-pressed={difficulty===level} onClick={()=>reset(level)}>{MINE_LEVELS[level].label}<small>{MINE_LEVELS[level].columns}×{MINE_LEVELS[level].rows}</small></button>)}</nav>
    <header className="mine-score"><span><small>剩余</small><strong>{String(config.mines-flags).padStart(3,"0")}</strong></span><button aria-label="重新开始" title="重新开始" onClick={()=>reset()}>{face}</button><span><small>用时</small><strong>{String(elapsed).padStart(3,"0")}</strong></span></header>
    <div className="mine-board" style={{"--mine-columns":config.columns,"--mine-rows":config.rows} as React.CSSProperties}>{board.map((cell,index)=>{const row=Math.floor(index/config.columns)+1,column=index%config.columns+1,label=cell.revealed?(cell.mine?"地雷":cell.nearby?`数字 ${cell.nearby}`:"空白"):cell.flagged?"已标记":"未翻开";return <button key={index} aria-label={`第 ${row} 行第 ${column} 列，${label}`} className={`${cell.revealed?"revealed":""} ${cell.mine&&cell.revealed?"mine":""} n${cell.nearby}`} onClick={()=>reveal(index)} onDoubleClick={()=>chord(index)} onContextMenu={(event)=>flag(event,index)}>{cell.revealed?(cell.mine?"✹":cell.nearby||""):cell.flagged?"⚑":""}</button>})}</div>
    <footer><span>{statusText}</span><span>最佳 {bestTimes[difficulty]===undefined?"---":`${bestTimes[difficulty]}s`}</span></footer>
  </div>
}

function Calculator(){
  const [display,setDisplay]=useState("0"),[stored,setStored]=useState<number|null>(null),[operation,setOperation]=useState<string|null>(null),[replace,setReplace]=useState(true),[formula,setFormula]=useState(""),[history,setHistory]=useState<string[]>([]);
  const calculate=(left:number,right:number,op:string)=>op==="+"?left+right:op==="−"?left-right:op==="×"?left*right:right===0?0:left/right;
  const showOperand=(value:string)=>setFormula(stored!==null&&operation?`${stored} ${operation} ${value}`:value);
  const press=(key:string)=>{
    if(/^\d$/.test(key)){const next=replace?key:display==="0"?key:display+key;setDisplay(next);showOperand(next);setReplace(false);return}
    if(key==="."){const next=replace?"0.":display.includes(".")?display:display+".";setDisplay(next);showOperand(next);setReplace(false);return}
    if(key==="C"){setDisplay("0");setStored(null);setOperation(null);setReplace(true);setFormula("");return}
    if(key==="±"){const next=String(Number(display)*-1);setDisplay(next);showOperand(next);return}
    if(key==="%"){const next=String(Number(display)/100);setDisplay(next);showOperand(next);return}
    if(["+","−","×","÷"].includes(key)){const current=Number(display),next=stored!==null&&operation&&!replace?calculate(stored,current,operation):current;setStored(next);setDisplay(String(next));setOperation(key);setFormula(`${next} ${key}`);setReplace(true);return}
    if(key==="="&&stored!==null&&operation){const result=calculate(stored,Number(display),operation),line=`${stored} ${operation} ${display} = ${result}`;setFormula(`${stored} ${operation} ${display} =`);setHistory((current)=>[line,...current].slice(0,4));setDisplay(String(result));setStored(null);setOperation(null);setReplace(true)}
  };
  return <div className="calculator"><header className="calculator-mode"><strong>标准</strong><button onClick={()=>setHistory([])}>清除历史</button></header><div className="calculator-history">{history.length?history.map((line,index)=><span key={`${line}-${index}`}>{line}</span>):<span>暂无计算历史</span>}</div><div className="calculator-formula">{formula||" "}</div><output>{display}</output><div className="calculator-keys">{["C","±","%","÷","7","8","9","×","4","5","6","−","1","2","3","+","0",".","="].map((key)=><button key={key} className={`${["÷","×","−","+","="].includes(key)?"operator":""} ${key==="0"?"zero":""}`} onClick={()=>press(key)}>{key}</button>)}</div></div>
}

function PhotoEditor({active,initialImage,onSaveToDesktop}:{active:boolean;initialImage:PhotoSource|null;onSaveToDesktop:(name:string,content:string)=>void}) {
  const [mode, setMode] = useState<Mode>("调整");
  const [edit, setEdit] = useState<EditState>(initialEdit);
  const [past, setPast] = useState<EditState[]>([]), [future, setFuture] = useState<EditState[]>([]);
  const [openGroups, setOpenGroups] = useState(["光效", "颜色", "黑白"]);
  const [openOptions, setOpenOptions] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
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

  const loadFile=(file?:File)=>{if(!file||!file.type.startsWith("image/"))return;if(sourceUrl.startsWith("blob:"))URL.revokeObjectURL(sourceUrl);const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{setSource(img);setSourceUrl(url);setFileName(file.name.replace(/\.[^.]+$/,"")||"照片");setEdit(initialEdit);setPast([]);setFuture([]);setZoom(1);setPan({x:0,y:0})};img.src=url};
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

  const exportImage=()=>{const canvas=canvasRef.current;if(!canvas)return;const{x,y,w,h}=edit.crop,sx=Math.round(x*canvas.width),sy=Math.round(y*canvas.height),sw=Math.max(1,Math.round(w*canvas.width)),sh=Math.max(1,Math.round(h*canvas.height)),output=document.createElement("canvas");output.width=sw;output.height=sh;output.getContext("2d")?.drawImage(canvas,sx,sy,sw,sh,0,0,sw,sh);onSaveToDesktop(`${fileName}-已编辑.jpg`,output.toDataURL("image/jpeg",.9))};
  useEffect(()=>{if(!active)return;const shortcut=(event:KeyboardEvent)=>{if(!(event.ctrlKey||event.metaKey))return;const key=event.key.toLowerCase();if(key==="s"){event.preventDefault();exportImage()}else if(key==="z"){event.preventDefault();event.shiftKey?redo():undo()}else if(key==="y"){event.preventDefault();redo()}else if(key==="0"){event.preventDefault();setZoomLevel(1)}else if(key==="="||key==="+"){event.preventDefault();setZoomLevel(zoom+.25)}else if(key==="-"){event.preventDefault();setZoomLevel(zoom-.25)}};window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut)},[active,edit,fileName,future,past,source,zoom]);
  const switchMode=(next:Mode)=>{setMode(next);if(next==="裁剪"){setZoomLevel(1);setPan({x:0,y:0})}};
  const clearImage=()=>{if(sourceUrl.startsWith("blob:"))URL.revokeObjectURL(sourceUrl);setSource(null);setSourceUrl("");setFileName("");setEdit(initialEdit);setPast([]);setFuture([]);setZoom(1);setPan({x:0,y:0});setMode("调整");setActiveTool(null)};

  return <main className="editor-shell" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();loadFile(e.dataTransfer.files[0])}}>
    <input ref={fileRef} className="file-input" type="file" accept="image/*" onChange={onFile}/>
    <header className="toolbar">
      <div className="left-tools"><button className="clear-photo" aria-label="清空图片" title="清空图片" disabled={!source} onClick={clearImage}>×</button>{source&&mode!=="裁剪"&&<div className="zoom-control"><button onClick={()=>setZoomLevel(zoom-.25)}>−</button><label className="zoom-track" onPointerDown={(e)=>{e.currentTarget.setPointerCapture(e.pointerId);updateZoomFromPointer(e)}} onPointerMove={(e)=>{if(e.buttons)updateZoomFromPointer(e)}}><input aria-label="缩放" type="range" min="1" max="5" step=".01" value={zoom} onChange={(e)=>setZoomLevel(Number(e.target.value))}/></label><button onClick={()=>setZoomLevel(zoom+.25)}>＋</button></div>}</div>
      <nav className="mode-tabs">{(["调整","滤镜","裁剪"] as Mode[]).map((item)=><button key={item} className={mode===item?"active":""} onClick={()=>switchMode(item)}>{item}</button>)}</nav>
      <div className="actions"><button title="导入照片" onClick={()=>fileRef.current?.click()}>＋</button><button disabled={!past.length} onClick={undo}>↶</button><button disabled={!future.length} onClick={redo}>↷</button><button className={favorite?"selected":""} onClick={()=>setFavorite(!favorite)}>{favorite?"♥":"♡"}</button><button onClick={()=>commit({...edit,rotation:(edit.rotation+90)%360})}>↻</button><button className="magic" onClick={()=>commit({...edit,values:{...edit.values,brilliance:24,exposure:7,highlights:-12,shadows:17,contrast:8,vibrance:18,definition:14}})}>✦</button><button className="done" title="存储到桌面" onClick={exportImage}>完成</button></div>
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
