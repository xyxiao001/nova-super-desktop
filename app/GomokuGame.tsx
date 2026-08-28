"use client";

import "./games-tools.css";

import { useEffect, useMemo, useRef, useState } from "react";
import GameResultDialog from "./GameResultDialog";
import { clearGameProgress, finishGame, loadGameProgress, saveGameProgress, subscribeGameReset, touchGame } from "./gameStorage";
import GomokuWorker from "./gomoku.worker?worker";
import { playNovaSound } from "./novaSettings";

type Stone = 0|1|2;
type Side = "black"|"white";
type Move = {row:number;column:number;stone:Exclude<Stone,0>};
type GomokuProgress = {moves:Move[];humanSide:Side};

const SIZE=15;
const EMPTY_BOARD=()=>Array<Stone>(SIZE*SIZE).fill(0);
const stoneFor=(side:Side):Exclude<Stone,0>=>side==="black"?1:2;
const enginePlayer=(stone:Exclude<Stone,0>):0|1=>stone===1?1:0;
const sideName=(stone:Exclude<Stone,0>)=>stone===1?"黑方":"白方";
const indexOf=(row:number,column:number)=>row*SIZE+column;
const hasFive=(board:Stone[],index:number,stone:Exclude<Stone,0>)=>{
  const row=Math.floor(index/SIZE),column=index%SIZE;
  return [[1,0],[0,1],[1,1],[1,-1]].some(([dr,dc])=>{
    let count=1;
    for(const direction of [-1,1]){
      let r=row+dr*direction,c=column+dc*direction;
      while(r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[indexOf(r,c)]===stone){count++;r+=dr*direction;c+=dc*direction}
    }
    return count>=5;
  });
};

export default function GomokuGame(){
  const [restored]=useState(()=>loadGameProgress<GomokuProgress>("gomoku"));
  const restoredMoves=restored?.moves??[];
  const [board,setBoard]=useState<Stone[]>(()=>{const next=EMPTY_BOARD();for(const move of restoredMoves)next[indexOf(move.row,move.column)]=move.stone;return next});
  const [moves,setMoves]=useState<Move[]>(restoredMoves);
  const [humanSide,setHumanSide]=useState<Side>(restored?.humanSide??"black");
  const [turn,setTurn]=useState<Exclude<Stone,0>>(restoredMoves.length%2===0?1:2);
  const [winner,setWinner]=useState<Exclude<Stone,0>|"draw"|null>(null);
  const [thinking,setThinking]=useState(false);
  const [rulesOpen,setRulesOpen]=useState(false);
  const [resultDismissed,setResultDismissed]=useState(false);
  const workerRef=useRef<Worker|null>(null);
  const requestIdRef=useRef(0);
  const boardRef=useRef(board);
  const movesRef=useRef(moves);
  const resultRef=useRef("");
  const aiStone=humanSide==="black"?2:1,humanStone=stoneFor(humanSide);
  const lastMove=moves.at(-1);
  const stars=useMemo(()=>new Set([3,7,11].flatMap((row)=>[3,7,11].map((column)=>indexOf(row,column)))),[]);

  useEffect(()=>{
    const worker=new GomokuWorker();
    workerRef.current=worker;
    worker.onmessage=(event:MessageEvent<{row?:number;column?:number;error?:string;requestId:number}>)=>{
      const {row,column,error,requestId}=event.data;
      if(requestId!==requestIdRef.current)return;
      setThinking(false);
      if(error||row===undefined||column===undefined)return;
      const index=indexOf(row,column),current=boardRef.current;
      if(current[index])return;
      const next=[...current],nextMoves:Move[]=[...movesRef.current,{row,column,stone:aiStone}];
      next[index]=aiStone;
      boardRef.current=next;
      movesRef.current=nextMoves;
      setBoard(next);
      setMoves(nextMoves);
      playNovaSound("move");
      if(hasFive(next,index,aiStone))setWinner(aiStone);
      else if(next.every(Boolean))setWinner("draw");
      else setTurn(humanStone);
    };
    return()=>worker.terminate();
  },[aiStone,humanStone]);
  useEffect(()=>{
    if(winner||turn!==aiStone||thinking)return;
    const timer=window.setTimeout(()=>{
      setThinking(true);
      const requestId=++requestIdRef.current;
      workerRef.current?.postMessage({moves:moves.map((move)=>({row:move.row,column:move.column,player:enginePlayer(move.stone)})),player:enginePlayer(aiStone),requestId});
    },180);
    return()=>window.clearTimeout(timer);
  },[aiStone,moves,thinking,turn,winner]);
  useEffect(()=>{touchGame("gomoku")},[]);
  useEffect(()=>{if(moves.length&&!winner)saveGameProgress<GomokuProgress>("gomoku",{moves,humanSide})},[humanSide,moves,winner]);
  useEffect(()=>{if(!winner)return;const key=`${winner}:${moves.length}`;if(resultRef.current===key)return;resultRef.current=key;const result=winner==="draw"?"draw":winner===humanStone?"win":"loss";finishGame("gomoku",result);playNovaSound(result==="win"?"success":result==="loss"?"error":"move")},[humanStone,moves.length,winner]);
  useEffect(()=>subscribeGameReset("gomoku",()=>restart(humanSide)),[humanSide]);

  const play=(index:number)=>{
    if(board[index]||winner||thinking||turn!==humanStone)return;
    const row=Math.floor(index/SIZE),column=index%SIZE,next=[...board];
    next[index]=humanStone;
    boardRef.current=next;
    setBoard(next);
    const nextMoves=[...moves,{row,column,stone:humanStone}];
    movesRef.current=nextMoves;
    setMoves(nextMoves);
    playNovaSound("move");
    if(hasFive(next,index,humanStone))setWinner(humanStone);
    else if(next.every(Boolean))setWinner("draw");
    else setTurn(aiStone);
  };
  function restart(side=humanSide){requestIdRef.current++;const next=EMPTY_BOARD();boardRef.current=next;movesRef.current=[];resultRef.current="";clearGameProgress("gomoku");touchGame("gomoku");setHumanSide(side);setBoard(next);setMoves([]);setWinner(null);setResultDismissed(false);setThinking(false);setTurn(1)}
  const undo=()=>{
    if(!moves.length||thinking)return;
    const removeCount=moves.length>1?2:1,nextMoves=moves.slice(0,-removeCount),next=EMPTY_BOARD();
    for(const move of nextMoves)next[indexOf(move.row,move.column)]=move.stone;
    movesRef.current=nextMoves;boardRef.current=next;setMoves(nextMoves);setBoard(next);setWinner(null);setTurn(nextMoves.length%2===0?1:2);
  };
  const status=winner==="draw"?"和棋":winner?`${sideName(winner)}获胜`:thinking?"AI 正在计算":`${sideName(turn)}落子`;

  return <main className="gomoku-game">
    <header className="board-game-toolbar">
      <div><strong>五子棋</strong><span>{status}</span></div>
      <label>执棋<select value={humanSide} onChange={(event)=>restart(event.target.value as Side)}><option value="black">玩家执黑</option><option value="white">玩家执白</option></select></label>
      <div className="board-game-actions"><button aria-label="五子棋规则" title="规则" onClick={()=>setRulesOpen(true)}>?</button><button aria-label="悔棋" title="悔棋" disabled={!moves.length||thinking} onClick={undo}>↶</button><button aria-label="重新开始五子棋" title="重新开始" onClick={()=>restart()}>↻</button></div>
    </header>
    <section className="oriental-game-layout">
      <div className="gomoku-board" role="grid" aria-label="五子棋棋盘">{board.map((stone,index)=>{const row=Math.floor(index/SIZE),column=index%SIZE,isLast=lastMove?.row===row&&lastMove.column===column;return <button key={index} className={`row-${row} column-${column}`} role="gridcell" aria-label={`第 ${row+1} 行第 ${column+1} 列${stone?`，${sideName(stone)}`:"，空位"}`} onClick={()=>play(index)}><i className="line horizontal"/><i className="line vertical"/>{stars.has(index)&&<i className="star"/>}{stone>0&&<span className={`board-stone ${stone===1?"black":"white"} ${isLast?"last":""}`}/>}</button>})}</div>
      <aside className="board-game-panel"><section><span>你</span><strong>{humanSide==="black"?"黑棋":"白棋"}</strong></section><section><span>对手</span><strong>Alpha-Beta AI</strong></section><section><span>手数</span><strong>{moves.length}</strong></section><p>AI 使用开源 Minimax 与 Alpha-Beta 剪枝引擎，重点识别连五、冲四、活三与防守要点。</p></aside>
    </section>
    {rulesOpen&&<section className="game-rules" role="dialog" aria-modal="true" aria-label="五子棋规则"><div><header><strong>五子棋规则</strong><button aria-label="关闭规则" onClick={()=>setRulesOpen(false)}>×</button></header><article><h3>胜负</h3><p>黑棋先行。任意一方在横、竖或斜线方向率先形成连续五枚或更多同色棋子即获胜。</p><h3>当前规则</h3><p>采用自由五子棋规则，不设置禁手；黑白双方均允许长连。棋盘为标准 15×15，落子后不能移动。</p><h3>人机对战</h3><p>可以选择执黑或执白。悔棋会同时撤回玩家和 AI 最近的一轮着法。</p></article></div></section>}
    {winner&&!resultDismissed&&<GameResultDialog tone={winner==="draw"?"draw":winner===humanStone?"win":"loss"} title={winner==="draw"?"本局和棋":winner===humanStone?"你赢了":"AI 获胜"} detail={`本局共进行 ${moves.length} 手`} onDismiss={()=>setResultDismissed(true)} onRestart={()=>restart()}/>}
  </main>
}
