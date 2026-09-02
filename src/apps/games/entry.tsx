"use client";

import "./games.css";

import { useEffect, useState } from "react";
import { useWindowRuntime } from "../../platform/windows/WindowRuntime";
import { readGameRecords, requestNewGame, subscribeGameRecords, type GameId, type GameRecords } from "./shared/gameStorage";
import { readGameCoins, resetGameCoins, subscribeGameCoins } from "./shared/gameCoins";

export const GAME_CATALOG = [
  {id:"mines",label:"扫雷",category:"逻辑",meta:"经典 · 三档难度",artwork:"/assets/game-covers/mines.jpg"},
  {id:"chess",label:"国际象棋",category:"策略",meta:"Stockfish 18",artwork:"/assets/game-covers/chess.jpg"},
  {id:"gomoku",label:"五子棋",category:"棋类",meta:"Alpha-Beta AI",artwork:"/assets/game-covers/gomoku.jpg"},
  {id:"tower",label:"魔塔",category:"角色扮演",meta:"77 层 · 完整剧情",artwork:"/assets/game-covers/tower.jpg"},
  {id:"youtd2",label:"YouTD 2",category:"塔防",meta:"200+ 防御塔 · 300+ 物品",artwork:"/assets/game-covers/youtd2.jpg"},
  {id:"wolfslot",label:"童年老虎机",category:"街机",meta:"开火车 · 大三元 · 猜大小",artwork:"/assets/games/wolf-slot/wolf-slot-icon-v2.png"},
] as const;

export type GameAppId = GameId;

export default function GameHall(){
  const {isAppOpen,openApp}=useWindowRuntime();
  const running=Object.fromEntries(GAME_CATALOG.map((game)=>[game.id,isAppOpen(game.id)])) as Record<GameAppId,boolean>;
  const runningCount=GAME_CATALOG.filter((game)=>running[game.id]).length;
  const [records,setRecords]=useState<GameRecords>(readGameRecords);
  const [coins,setCoins]=useState(readGameCoins);
  const [resetConfirm,setResetConfirm]=useState(false);
  useEffect(()=>subscribeGameRecords(()=>setRecords(readGameRecords())),[]);
  useEffect(()=>subscribeGameCoins(()=>setCoins(readGameCoins())),[]);
  const recent=GAME_CATALOG.map((game)=>({...game,time:records[game.id].lastPlayed})).filter((game)=>game.time).sort((a,b)=>b.time!-a.time!)[0];
  const recentText=recent?`最近游玩 · ${recent.label}`:"尚无本地对局";
  const newGame=(id:GameAppId)=>{requestNewGame(id);openApp(id)};

  return <main className="game-hall">
    <header className="game-hall-header">
      <div className="game-hall-brand">
        <span className="game-hall-logo" aria-hidden="true"><i/><i/><i/><i/></span>
        <div><strong>游戏大厅</strong><small>NOVA LOCAL ARCADE</small></div>
      </div>
      <div className="game-hall-meta"><div className="game-hall-wallet"><span>全局金币</span><strong>{coins}</strong><button type="button" onClick={()=>setResetConfirm(true)}>重置</button></div><div className="game-hall-status">{runningCount?<><b>{runningCount}</b><span>正在运行</span></>:<span>{recentText}</span>}</div></div>
    </header>
    <section className="game-library" aria-label="本机游戏">
      {GAME_CATALOG.map((game)=>{const record=records[game.id];const launchLabel=record.hasProgress?"继续游戏":"开始游戏";return <article key={game.id} className={`game-tile ${game.id}-tile`} role="button" tabIndex={0} aria-label={`${launchLabel}：${game.label}`} onClick={()=>openApp(game.id)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openApp(game.id)}}}>
        <div className="game-tile-visual">
          <img src={game.artwork} alt=""/>
          <span className="game-category">{game.category}</span>
          <span className="game-play-cue" aria-hidden="true"><i>▶</i>{record.hasProgress?"继续":"开始"}</span>
        </div>
        <div className="game-tile-info">
          <header><strong>{game.label}</strong>{running[game.id]&&<span>运行中</span>}</header>
          <small>{game.meta}</small>
          <footer><div className="game-tile-record"><span>{record.played} 局</span><span>{record.wins} 胜</span><span>{record.losses} 负</span>{record.draws>0&&<span>{record.draws} 和</span>}</div><div className="game-tile-actions">{record.hasProgress&&<button className="new-game-button" aria-label={`新开${game.label}`} title="新游戏" onClick={(event)=>{event.stopPropagation();newGame(game.id)}}>↻</button>}<span className="game-tile-action">{launchLabel}<i aria-hidden="true">→</i></span></div></footer>
        </div>
      </article>})}
    </section>
    <footer className="game-hall-footer"><span>{GAME_CATALOG.length} 款本机游戏</span><span>离线运行</span></footer>
    {resetConfirm&&<div className="game-coins-confirm-layer"><section role="dialog" aria-modal="true" aria-label="确认重置全局金币"><strong>重置全局金币？</strong><p>大厅金币将恢复为 500，正在游戏中的机内积分不会改变。</p><div><button type="button" onClick={()=>setResetConfirm(false)}>取消</button><button className="confirm" type="button" onClick={()=>{resetGameCoins();setResetConfirm(false)}}>确认重置</button></div></section></div>}
  </main>
}
