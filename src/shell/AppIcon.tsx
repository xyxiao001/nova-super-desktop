import type { ReactNode } from "react";
import type { WindowAppId } from "../platform/apps/appRegistry";
import "./appIcons.css";

export type AppIconName = WindowAppId | "text-file" | "folder-file";
const folder = <><path d="M6 15a3 3 0 0 1 3-3h10l4 4h16a3 3 0 0 1 3 3v17H6Z" fill="currentColor" opacity=".25" /><path d="M6 21h36l-3 16H9Z" fill="currentColor" /><path d="M12 24h23" stroke="#fff" opacity=".65" /></>;
const paper = <><rect x="11" y="7" width="27" height="35" rx="4" fill="currentColor" opacity=".18" stroke="none" /><path d="M10 6h20l7 7v25H10Z" fill="#fff" /><path d="M30 6v8h7M16 20h15M16 26h15M16 32h10" /><path d="M10 11h13" opacity=".4" /></>;
const marks: Record<AppIconName, ReactNode> = {
  music: <><circle cx="24" cy="24" r="17" fill="currentColor" stroke="none" /><circle cx="24" cy="24" r="12" stroke="#fff" opacity=".25" /><path d="M27 12v17c-7-3-11 4-6 6 3 1 6-1 6-4M27 13l7 4" stroke="#fff" strokeWidth="2.6" /><path d="m10 14 4 2m19 18 3 2" stroke="#fff" opacity=".3" /></>,
  radio: <><path d="m16 13 19-7" /><rect x="6" y="14" width="36" height="27" rx="6" fill="currentColor" opacity=".2" /><rect x="10" y="18" width="28" height="7" rx="2" fill="currentColor" stroke="none" /><path d="M15 20v3m5-3v3m5-3v3" stroke="#fff" opacity=".8" /><circle cx="33" cy="33" r="4" fill="#fff" /><path d="M12 31h11M12 35h11" /></>,
  weather: <><g fill="currentColor" stroke="none"><circle cx="29" cy="18" r="9" /><circle cx="29" cy="18" r="14" opacity=".12" /></g><path d="M29 3v2M44 18h-2M40 7l-2 2M18 7l2 2" /><path d="M12 36a6 6 0 0 1-1-12 9 9 0 0 1 17-3 8 8 0 0 1 8 15Z" fill="#fff" stroke="#8ba4b0" strokeWidth="1.6" /></>,
  gallery: <><rect x="6" y="9" width="36" height="31" rx="2" fill="currentColor" opacity=".22" /><path d="M11 14h26v21H11Z" fill="#fff8e5" /><circle cx="29" cy="20" r="3" fill="#dfb36c" stroke="none" /><path d="m12 32 9-10 6 7 4-4 5 7" fill="currentColor" stroke="none" opacity=".8" /><path d="M7 10l4 4m26 21 4 4" opacity=".5" /></>,
  photo: <><path d="M16 13l3-5h10l3 5h7a4 4 0 0 1 4 4v19H5V17a4 4 0 0 1 4-4Z" fill="currentColor" opacity=".18" /><circle cx="24" cy="25" r="10" fill="currentColor" /><circle cx="24" cy="25" r="5" stroke="#fff" /><path d="m35 8 1-3 1 3 3 1-3 1-1 3-1-3-3-1Z" fill="#fff" stroke="none" /><circle cx="12" cy="19" r="1" fill="currentColor" /></>,
  explorer: folder,
  folder: folder,
  "folder-file": folder,
  notes: <><rect x="9" y="7" width="31" height="35" rx="4" fill="currentColor" opacity=".2" /><path d="M8 6h29v34H8Z" fill="#fffcf3" /><path d="M13 6v34M19 15h12M19 22h12M19 29h9" /><path d="M5 12h6M5 21h6M5 30h6" strokeWidth="3" /></>,
  "text-file": paper,
  viewer: <><rect x="9" y="7" width="32" height="31" rx="4" fill="currentColor" opacity=".2" transform="rotate(9 25 23)" /><rect x="6" y="13" width="32" height="28" rx="3" fill="#fff" /><circle cx="29" cy="21" r="4" fill="#eccb82" stroke="none" /><path d="m9 37 10-13 7 8 5-4 5 9Z" fill="currentColor" stroke="none" opacity=".8" /></>,
  reader: <><path d="M24 13C18 9 10 9 5 11v26c7-2 13-1 19 3 6-4 12-5 19-3V11c-5-2-13-2-19 2Z" fill="currentColor" opacity=".15" /><path d="M24 12v28M10 17c3-1 6 0 9 1m-9 6c3-1 6 0 9 1m10-7c3-1 6-2 9-1m-9 8c3-1 6-2 9-1" /><path d="M31 9v12l3-2 3 2V9" fill="currentColor" stroke="none" /></>,
  calendar: <><rect x="8" y="9" width="32" height="32" rx="5" fill="#fffdf7" /><path d="M8 19h32V13a4 4 0 0 0-4-4H12a4 4 0 0 0-4 4Z" fill="currentColor" /><path d="M16 6v8M32 6v8" strokeWidth="3" /><g fill="currentColor" stroke="none"><rect x="15" y="25" width="5" height="5" rx="1" /><rect x="25" y="25" width="8" height="10" rx="1" /><circle cx="17.5" cy="34" r="2" /></g></>,
  games: <><path d="M13 15h22c5 0 7 8 8 19 0 5-5 6-8 2l-4-5H17l-4 5c-3 4-8 3-8-2 1-11 3-19 8-19Z" fill="currentColor" opacity=".2" /><path d="M15 20v10M10 25h10" strokeWidth="3" /><circle cx="34" cy="22" r="2.5" fill="currentColor" stroke="none" /><circle cx="29" cy="28" r="2.5" fill="currentColor" stroke="none" /><path d="M20 13h8" opacity=".5" /></>,
  cybercity: <><path d="M6 40h36M8 39V18h11v21M20 39V7h12v32M34 39V24h7v15" fill="currentColor" opacity=".28" /><path d="M12 24h3m-3 6h3m9-16h4m-4 7h4m-4 7h4m9 2h1" stroke="#fff" strokeWidth="2.5" /><path d="m5 12 2-2m30-1 2-2" opacity=".5" /></>,
  settings: <><path d="m20 6 8 0 1 6 5 3 6-2 4 7-5 4v6l4 4-4 7-6-2-5 3-1 4h-8l-1-5-5-3-6 2-4-7 4-4v-6l-4-4 4-7 6 2 5-3Z" transform="translate(2 -1) scale(.9)" fill="currentColor" opacity=".2" /><circle cx="24" cy="24" r="8" fill="currentColor" stroke="none" /><circle cx="24" cy="24" r="4" fill="#fff" stroke="none" /></>,
  recycle: <><path d="M12 15h24l-2 26H14Z" fill="currentColor" opacity=".2" /><path d="M9 14h30M18 9h12M19 21v13M29 21v13" /><path d="M14 38h20" opacity=".4" /></>,
  calculator: <><rect x="10" y="5" width="29" height="38" rx="5" fill="currentColor" opacity=".2" /><rect x="15" y="10" width="19" height="10" rx="2" fill="currentColor" /><path d="M18 26v7m-3-3h6M27 27h5m-5 5h5" strokeWidth="2.5" /><path d="M15 37h17" opacity=".4" /></>,
  drawing: <><path d="M7 39c2-10 7-2 10-8l6 7c-5 7-12 5-16 1Z" fill="currentColor" opacity=".6" /><path d="m17 29 19-22 6 6-21 20Z" fill="currentColor" opacity=".25" /><path d="m30 14 7 6m-20 9 6 5M11 40l6-4" /><circle cx="10" cy="13" r="4" fill="currentColor" stroke="none" opacity=".2" /></>,
  focus: <><circle cx="24" cy="26" r="16" fill="currentColor" opacity=".15" /><path d="M24 10a16 16 0 0 1 16 16H24Z" fill="currentColor" stroke="none" /><path d="M19 5h10M24 5v5m13 3 3 3M24 26l-6 8" strokeWidth="2.5" /><circle cx="24" cy="26" r="2" fill="#fff" stroke="none" /></>,
  mines: <><circle cx="24" cy="25" r="11" fill="currentColor" /><path d="M24 8v5m0 24v5M7 25h5m25 0h5M12 13l4 4m16 16 4 4M12 37l4-4m16-16 4-4" /><circle cx="20" cy="21" r="3" fill="#fff" stroke="none" /></>,
  chess: <><path d="M11 40h28M14 35h23l-3-8c9-7 2-21-9-21l-1 5-8 6-4 9 10 1 3-6v8l-8 6" fill="currentColor" opacity=".35" /><circle cx="26" cy="15" r="1.5" fill="currentColor" stroke="none" /></>,
  gomoku: <><path d="M7 15h34M7 25h34M7 35h34M15 7v34M25 7v34M35 7v34" opacity=".35" /><circle cx="15" cy="25" r="7" fill="currentColor" /><circle cx="35" cy="15" r="7" fill="#fff" /></>,
  tower: <><path d="M11 40V16h26v24M8 10h7v6h6v-6h6v6h6v-6h7v13H8Z" fill="currentColor" opacity=".3" /><path d="M20 40V29a4 4 0 0 1 8 0v11" fill="currentColor" /><path d="M9 40h30" /></>,
  youtd2: <><path d="m24 5 18 7v13c-2 9-11 16-18 19C17 41 8 34 6 25V12Z" fill="currentColor" opacity=".22" /><path d="m15 16 9 9 9-9M24 25v11" strokeWidth="3" /></>,
  wolfslot: <><rect x="5" y="12" width="38" height="28" rx="6" fill="currentColor" opacity=".2" /><path d="M17 17v16M31 17v16M10 20h3l-2 9m10-9h6l-4 9m12-9h3l-2 9" /><path d="M12 8h24" strokeWidth="3" /></>,
};
export default function AppIcon({ name, className = "" }: { name: AppIconName; className?: string }) {
  return <i className={`nova-app-icon icon-${name} ${className}`} aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" focusable="false">{marks[name]}</svg></i>;
}
