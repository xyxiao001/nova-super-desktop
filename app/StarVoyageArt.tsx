"use client";

import { useId } from "react";

import type { EnemyDefinition, VoyageCardId, VoyageNodeType } from "./starVoyageCore";

export function PlayerShipArt() {
  const id = useId().replaceAll(":", "");
  return <svg className="voyage-ship-art player" viewBox="0 0 360 210" role="img" aria-label="远征舰晨星号">
    <defs>
      <linearGradient id={`${id}-body`} x1="0" x2="1"><stop stopColor="#dde4df"/><stop offset=".5" stopColor="#758b8d"/><stop offset="1" stopColor="#273a3f"/></linearGradient>
      <linearGradient id={`${id}-wing`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#55696d"/><stop offset="1" stopColor="#17282d"/></linearGradient>
      <filter id={`${id}-glow`}><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <ellipse cx="104" cy="107" rx="66" ry="18" fill="#5de0d0" opacity=".2" filter={`url(#${id}-glow)`}/>
    <path d="M34 101 123 65 288 88 335 105 286 124 122 141Z" fill={`url(#${id}-body)`} stroke="#d8e4df" strokeWidth="2"/>
    <path d="m124 65 45-45 116 67-55-5Z" fill={`url(#${id}-wing)`} stroke="#72898b"/>
    <path d="m124 141 46 45 115-61-57 4Z" fill={`url(#${id}-wing)`} stroke="#72898b"/>
    <path d="m206 82 49 9 27 14-28 14-50 8-28-22Z" fill="#1a282d" stroke="#9bb1af"/>
    <path d="m219 91 38 8-13 8-39-5Z" fill="#66e4d0" opacity=".82"/>
    <path d="M50 92 17 104l34 14 50-7v-12Z" fill="#27383c"/>
    <path d="M26 102 3 106l24 5 27-5Z" fill="#f19163"/>
    <circle cx="300" cy="105" r="7" fill="#f1c970"/><circle cx="300" cy="105" r="17" fill="none" stroke="#f1c970" opacity=".35"/>
    <g fill="#c8d4d0"><rect x="141" y="91" width="7" height="28" rx="2"/><rect x="154" y="87" width="5" height="36" rx="2"/></g>
  </svg>;
}

export function EnemyShipArt({ art }: { art: EnemyDefinition["art"] }) {
  const id = useId().replaceAll(":", "");
  const colors = {
    drone: ["#d4bc76", "#695733", "#f6da7d"],
    raider: ["#be5b4b", "#552d2c", "#ff8c68"],
    guardian: ["#71888c", "#293a41", "#8ee1d1"],
    warden: ["#c8c1b3", "#443f3d", "#f2b35e"],
  }[art];
  if (art === "drone") return <svg className="voyage-ship-art enemy" viewBox="0 0 360 210" role="img" aria-label="拾荒蜂群">
    <defs><filter id={`${id}-glow`}><feGaussianBlur stdDeviation="5"/></filter></defs>
    {[68, 150, 232].map((x, index) => <g key={x} transform={`translate(${x} ${index === 1 ? 20 : 0})`}>
      <ellipse cx="30" cy="105" rx="44" ry="12" fill={colors[2]} opacity=".16" filter={`url(#${id}-glow)`}/>
      <path d="m0 105 30-28 52 17 16 11-17 13-50 15Z" fill={colors[0]} stroke="#eee0ad"/>
      <circle cx="59" cy="105" r="8" fill={colors[2]}/><path d="M28 78 11 50l37 35M28 132 11 160l37-35" stroke={colors[1]} strokeWidth="8"/>
    </g>)}
  </svg>;
  if (art === "warden") return <svg className="voyage-ship-art enemy" viewBox="0 0 360 210" role="img" aria-label="星门典狱长">
    <defs><radialGradient id={`${id}-core`}><stop stopColor="#fff0bd"/><stop offset=".35" stopColor={colors[2]}/><stop offset="1" stopColor="#9f4b35"/></radialGradient></defs>
    <circle cx="205" cy="105" r="87" fill="none" stroke={colors[0]} strokeWidth="13" strokeDasharray="55 12"/>
    <circle cx="205" cy="105" r="62" fill="none" stroke="#796f65" strokeWidth="4"/>
    <path d="M43 105 145 54l99 51-99 51Z" fill={colors[1]} stroke={colors[0]} strokeWidth="3"/>
    <path d="m108 84 39-48 31 36M108 126l39 48 31-36" fill="#393838" stroke="#a69f93"/>
    <circle cx="205" cy="105" r="24" fill={`url(#${id}-core)`}/>
    <path d="M258 105h88M205 24V3M205 186v21" stroke={colors[2]} strokeWidth="4" opacity=".7"/>
  </svg>;
  return <svg className="voyage-ship-art enemy" viewBox="0 0 360 210" role="img" aria-label={art === "raider" ? "赤潮掠夺舰" : "环带守卫"}>
    <defs><linearGradient id={`${id}-hull`} x1="0" x2="1"><stop stopColor={colors[0]}/><stop offset="1" stopColor={colors[1]}/></linearGradient></defs>
    <path d={art === "raider" ? "M28 105 148 42 321 83 347 105 321 127 148 168Z" : "M22 105 116 55 298 65 344 105 298 145 116 155Z"} fill={`url(#${id}-hull)`} stroke={colors[0]} strokeWidth="3"/>
    <path d="m127 61 32-42 93 51-57 3ZM127 149l32 42 93-51-57-3Z" fill={colors[1]} stroke={colors[0]}/>
    <path d="m218 76 63 10 29 19-29 19-63 10-35-29Z" fill="#171e21" stroke={colors[0]}/>
    <path d="M51 92 11 105l40 13 53-13Z" fill={colors[1]}/>
    <circle cx="279" cy="105" r="12" fill={colors[2]}/><path d="M290 105h65" stroke={colors[2]} strokeWidth="4" opacity=".55"/>
  </svg>;
}

export function VoyageCardArt({ cardId }: { cardId: VoyageCardId }) {
  const attack = ["pulse", "overcharge", "ion-burst", "scatter", "plasma"].includes(cardId);
  const system = ["brace", "repair-drone", "phase-shield"].includes(cardId);
  const color = attack ? "#e87957" : system ? "#56b8aa" : "#d5ad58";
  const glyph: Record<VoyageCardId, string> = {
    pulse: "M18 55 45 26l7 22 40-30-27 52-8-22Z",
    brace: "M20 24 55 13l35 11v28c0 22-15 38-35 46-20-8-35-24-35-46Z",
    overcharge: "m12 68 31-42 7 26 49-35-37 60-8-25Z",
    "repair-drone": "M20 38h22V16h26v22h22v26H68v22H42V64H20Z",
    "ion-burst": "M55 9 67 39l33 4-25 22 8 33-28-17-28 17 8-33L10 43l33-4Z",
    "phase-shield": "M14 55c7-29 21-42 41-42s34 13 41 42c-7 29-21 42-41 42S21 84 14 55Zm15 0c5 19 13 27 26 27s21-8 26-27c-5-19-13-27-26-27s-21 8-26 27Z",
    scatter: "M13 30h28v12H13Zm28 28h28v12H41Zm28-28h28v12H69Z",
    capacitor: "M27 13h56v18H67v48h16v18H27V79h16V31H27Z",
    scan: "M12 55c11-25 25-37 43-37s32 12 43 37c-11 25-25 37-43 37S23 80 12 55Zm43-20a20 20 0 1 0 0 40 20 20 0 0 0 0-40Z",
    corrosion: "M55 10 93 33v44L55 100 17 77V33Zm0 19-21 13v26l21 13 21-13V42Z",
    plasma: "M55 5 70 41l35 14-35 14-15 36-15-36L5 55l35-14Z",
  };
  return <svg className="voyage-card-art" viewBox="0 0 110 110" aria-hidden="true">
    <circle cx="55" cy="55" r="47" fill={color} opacity=".1"/><circle cx="55" cy="55" r="37" fill="none" stroke={color} opacity=".28"/>
    <path d={glyph[cardId]} fill={color}/><path d="M8 92h94" stroke={color} opacity=".45"/>
  </svg>;
}

export function VoyageNodeArt({ type }: { type: VoyageNodeType }) {
  const symbols: Record<VoyageNodeType, string> = { combat: "◇", elite: "◆", event: "?", shop: "¤", repair: "+", boss: "✦" };
  return <span className={`voyage-node-art ${type}`} aria-hidden="true"><i/><b>{symbols[type]}</b></span>;
}

export function VoyageEmblem() {
  return <svg className="voyage-emblem" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="42 12"/>
    <path d="m12 58 38-34 38 34-38 20Z" fill="currentColor"/><path d="m50 24 11 31-11 23-11-23Z" fill="#27363a"/>
  </svg>;
}
