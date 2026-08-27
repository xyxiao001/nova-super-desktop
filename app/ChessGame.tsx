"use client";

import { useMemo, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

const PIECES:Record<Color,Record<PieceSymbol,string>> = {
  w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"},
  b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"},
};
const PIECE_NAMES:Record<PieceSymbol,string> = {k:"王",q:"后",r:"车",b:"象",n:"马",p:"兵"};
const FILES=["a","b","c","d","e","f","g","h"];
const copyGame=(source:Chess)=>{const next=new Chess(),pgn=source.pgn();if(pgn)next.loadPgn(pgn);return next};

export default function ChessGame(){
  const [game,setGame]=useState(()=>new Chess());
  const [selected,setSelected]=useState<Square|null>(null);
  const [lastMove,setLastMove]=useState<{from:Square;to:Square}|null>(null);
  const [orientation,setOrientation]=useState<Color>("w");
  const history=game.history(),turn=game.turn();
  const legalTargets=useMemo(()=>new Set<Square>(selected?game.moves({square:selected,verbose:true}).map((move)=>move.to):[]),[game,selected]);
  const files=orientation==="w"?FILES:[...FILES].reverse(),ranks=orientation==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];

  const selectSquare=(square:Square)=>{
    if(game.isGameOver())return;
    const piece=game.get(square);
    if(selected&&legalTargets.has(square)){
      const next=copyGame(game),move=next.move({from:selected,to:square,promotion:"q"});
      setLastMove({from:move.from,to:move.to});
      setSelected(null);
      setGame(next);
      return;
    }
    if(piece?.color===turn){
      setSelected(square);
      return;
    }
    setSelected(null);
  };
  const undo=()=>{const next=copyGame(game),move=next.undo();if(!move)return;setGame(next);setLastMove(null);setSelected(null)};
  const restart=()=>{setGame(new Chess());setLastMove(null);setSelected(null)};
  const status=game.isCheckmate()?`${turn==="w"?"白方":"黑方"}被将死`:game.isDraw()?"和棋":`${turn==="w"?"白方":"黑方"}走${game.isCheck()?" · 将军":""}`;

  return <main className="chess-game">
    <header className="chess-toolbar"><div><strong>本地双人</strong><span className={game.isCheck()?"check":""}>{status}</span></div><div><button aria-label="悔棋" title="悔棋" disabled={!history.length} onClick={undo}>↶</button><button aria-label="翻转棋盘" title="翻转棋盘" onClick={()=>setOrientation(orientation==="w"?"b":"w")}>⇅</button><button aria-label="重新开始" title="重新开始" onClick={restart}>↻</button></div></header>
    <section className="chess-layout">
      <div className="chess-board" role="grid" aria-label="国际象棋棋盘">{ranks.flatMap((rank,rowIndex)=>files.map((file,columnIndex)=>{const square=`${file}${rank}` as Square,piece=game.get(square),legal=legalTargets.has(square),isLast=lastMove?.from===square||lastMove?.to===square;return <button role="gridcell" key={square} aria-label={`${square}${piece?`，${piece.color==="w"?"白方":"黑方"}${PIECE_NAMES[piece.type]}`:"，空格"}`} className={`chess-square ${(rowIndex+columnIndex)%2?"dark":"light"} ${selected===square?"selected":""} ${legal?"legal":""} ${legal&&piece?"capture":""} ${isLast?"last":""}`} onClick={()=>selectSquare(square)}>{piece&&<span className={`chess-piece ${piece.color==="w"?"white":"black"}`}>{PIECES[piece.color][piece.type]}</span>}{columnIndex===0&&<small className="rank-label">{rank}</small>}{rowIndex===7&&<small className="file-label">{file}</small>}</button>}))}</div>
      <aside className="chess-moves"><header><strong>对局记录</strong><span>{Math.ceil(history.length/2)} 回合</span></header><div>{history.length?Array.from({length:Math.ceil(history.length/2)},(_,index)=><p key={index}><b>{index+1}.</b><span>{history[index*2]}</span><span>{history[index*2+1]??""}</span></p>):<div className="chess-empty">等待白方走棋</div>}</div></aside>
    </section>
  </main>
}
