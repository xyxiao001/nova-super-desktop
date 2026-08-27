"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Game, type GoColor } from "tenuki";
import GoWorker from "./go.worker?worker";

type Side = "black"|"white";
type Move = {row:number;column:number}|null;

const SIZE=9;
const createGame=(moves:Move[])=>{
  const game=new Game({boardSize:SIZE,scoring:"area",koRule:"positional-superko",komi:6.5});
  for(const move of moves)move?game.playAt(move.row,move.column,{render:false}):game.pass({render:false});
  return game;
};
const opposite=(color:GoColor):GoColor=>color==="black"?"white":"black";
const colorName=(color:GoColor)=>color==="black"?"黑方":"白方";

export default function GoGame(){
  const [moves,setMoves]=useState<Move[]>([]);
  const [humanSide,setHumanSide]=useState<Side>("black");
  const [thinking,setThinking]=useState(false);
  const [rulesOpen,setRulesOpen]=useState(false);
  const [error,setError]=useState("");
  const workerRef=useRef<Worker|null>(null);
  const requestIdRef=useRef(0);
  const game=useMemo(()=>createGame(moves),[moves]);
  const humanColor=humanSide as GoColor,aiColor=opposite(humanColor),turn=game.currentPlayer(),over=game.isOver();
  const state=game.currentState(),lastMove=moves.at(-1),score=over?game.score():null;
  const board=state.intersections.map((intersection)=>intersection.value);
  const stars=useMemo(()=>new Set([[2,2],[2,6],[4,4],[6,2],[6,6]].map(([row,column])=>row*SIZE+column)),[]);

  useEffect(()=>{
    const worker=new GoWorker();
    workerRef.current=worker;
    worker.onmessage=(event:MessageEvent<{row?:number;column?:number;pass?:boolean;error?:string;requestId:number}>)=>{
      if(event.data.requestId!==requestIdRef.current)return;
      setThinking(false);
      if(event.data.error){setError(event.data.error);return}
      setMoves((current)=>[...current,event.data.pass?null:{row:event.data.row!,column:event.data.column!}]);
    };
    return()=>worker.terminate();
  },[]);
  useEffect(()=>{
    if(over||turn!==aiColor||thinking)return;
    const timer=window.setTimeout(()=>{
      setThinking(true);
      const requestId=++requestIdRef.current;
      workerRef.current?.postMessage({moves,aiColor,requestId});
    },220);
    return()=>window.clearTimeout(timer);
  },[aiColor,moves,over,thinking,turn]);

  const play=(row:number,column:number)=>{
    if(over||thinking||turn!==humanColor)return;
    const candidate=createGame(moves);
    if(!candidate.playAt(row,column,{render:false})){setError("此处不能落子：可能是禁入点或违反超级劫");return}
    setError("");
    setMoves((current)=>[...current,{row,column}]);
  };
  const pass=()=>{if(over||thinking||turn!==humanColor)return;setMoves((current)=>[...current,null])};
  const restart=(side=humanSide)=>{requestIdRef.current++;setHumanSide(side);setMoves([]);setThinking(false);setError("")};
  const undo=()=>{if(!moves.length||thinking)return;requestIdRef.current++;setMoves((current)=>current.slice(0,-Math.min(2,current.length)));setError("")};
  const status=over?score&&score.black>score.white?`黑方胜 ${Math.abs(score.black-score.white).toFixed(1)} 目`:score&&score.white>score.black?`白方胜 ${Math.abs(score.white-score.black).toFixed(1)} 目`:"和棋":thinking?"AI 正在进行蒙特卡洛搜索":error||`${colorName(turn)}落子`;

  return <main className="go-game">
    <header className="board-game-toolbar">
      <div><strong>围棋 · 9 路</strong><span>{status}</span></div>
      <label>执棋<select value={humanSide} onChange={(event)=>restart(event.target.value as Side)}><option value="black">玩家执黑</option><option value="white">玩家执白</option></select></label>
      <div className="board-game-actions"><button aria-label="围棋规则" title="规则" onClick={()=>setRulesOpen(true)}>?</button><button aria-label="停一手" title="停一手" disabled={over||thinking||turn!==humanColor} onClick={pass}>停</button><button aria-label="悔棋" title="悔棋" disabled={!moves.length||thinking} onClick={undo}>↶</button><button aria-label="重新开始围棋" title="重新开始" onClick={()=>restart()}>↻</button></div>
    </header>
    <section className="oriental-game-layout">
      <div className="go-board" role="grid" aria-label="九路围棋棋盘">{board.map((value,index)=>{const row=Math.floor(index/SIZE),column=index%SIZE,isLast=lastMove?.row===row&&lastMove.column===column;return <button key={index} role="gridcell" aria-label={`第 ${row+1} 行第 ${column+1} 列${value==="empty"?"，空位":`，${colorName(value)}`}`} onClick={()=>play(row,column)}><i className={`go-lines row-${row} column-${column}`}/>{stars.has(index)&&<i className="star"/>}{value!=="empty"&&<span className={`board-stone ${value} ${isLast?"last":""}`}/>}</button>})}</div>
      <aside className="board-game-panel"><section><span>黑方提子</span><strong>{state.whiteStonesCaptured}</strong></section><section><span>白方提子</span><strong>{state.blackStonesCaptured}</strong></section><section><span>贴目</span><strong>白 6.5</strong></section><section><span>手数</span><strong>{moves.length}</strong></section><p>规则由 Tenuki 校验，AI 结合提子、气、形势估值与候选点蒙特卡洛模拟。</p></aside>
    </section>
    {rulesOpen&&<section className="game-rules" role="dialog" aria-modal="true" aria-label="围棋规则"><div><header><strong>九路围棋规则</strong><button aria-label="关闭规则" onClick={()=>setRulesOpen(false)}>×</button></header><article><h3>落子与提子</h3><p>黑棋先行，双方轮流在交叉点落子。棋子落下后不移动；一块棋所有相邻的“气”被占满时整块被提走。</p><h3>禁入点与劫</h3><p>不能在落子后自身无气且不能提子的点落子。采用位置超级劫规则，不允许棋盘局面重复。</p><h3>结束与计分</h3><p>任意一方可以停一手，连续两次停一手后结束。采用中国面积规则，棋子和围住的空点均计分，白方贴 6.5 目。</p><h3>AI</h3><p>AI 从规则内核提供的合法着法中筛选战术候选点，再通过局部形状评估和多轮蒙特卡洛模拟选择落子。</p></article></div></section>}
  </main>
}
