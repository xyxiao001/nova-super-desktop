"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

type ClockPreset = "none" | "blitz" | "rapid" | "classic";
type ClockState = Record<Color,number>;
type GameMode = "ai" | "local";
type EngineLevel = "casual" | "club" | "master";

const PIECES:Record<Color,Record<PieceSymbol,string>> = {
  w:{k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"},
  b:{k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"},
};
const PIECE_NAMES:Record<PieceSymbol,string> = {k:"王",q:"后",r:"车",b:"象",n:"马",p:"兵"};
const FILES=["a","b","c","d","e","f","g","h"];
const CLOCK_PRESETS:Record<ClockPreset,{label:string;seconds:number}> = {
  none:{label:"不限时",seconds:0},
  blitz:{label:"5 分钟",seconds:300},
  rapid:{label:"10 分钟",seconds:600},
  classic:{label:"15 分钟",seconds:900},
};
const ENGINE_LEVELS:Record<EngineLevel,{label:string;skill:number;moveTime:number}> = {
  casual:{label:"休闲",skill:3,moveTime:260},
  club:{label:"进阶",skill:10,moveTime:520},
  master:{label:"大师",skill:18,moveTime:900},
};
const copyGame=(source:Chess)=>{const next=new Chess(),pgn=source.pgn();if(pgn)next.loadPgn(pgn);return next};
const initialClock=(preset:ClockPreset):ClockState=>({w:CLOCK_PRESETS[preset].seconds,b:CLOCK_PRESETS[preset].seconds});
const colorName=(color:Color)=>color==="w"?"白方":"黑方";
const formatClock=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;

export default function ChessGame(){
  const [game,setGame]=useState(()=>new Chess());
  const [selected,setSelected]=useState<Square|null>(null);
  const [lastMove,setLastMove]=useState<{from:Square;to:Square}|null>(null);
  const [orientation,setOrientation]=useState<Color>("w");
  const [mode,setMode]=useState<GameMode>("ai");
  const [humanColor,setHumanColor]=useState<Color>("w");
  const [engineLevel,setEngineLevel]=useState<EngineLevel>("club");
  const [engineReady,setEngineReady]=useState(false);
  const [aiThinking,setAiThinking]=useState(false);
  const [rulesOpen,setRulesOpen]=useState(false);
  const [clockPreset,setClockPreset]=useState<ClockPreset>("none");
  const [timeLeft,setTimeLeft]=useState<ClockState>(()=>initialClock("none"));
  const [clockRunning,setClockRunning]=useState(false);
  const [message,setMessage]=useState("");
  const importRef=useRef<HTMLInputElement>(null);
  const workerRef=useRef<Worker|null>(null);
  const gameRef=useRef(game);
  const pendingFenRef=useRef("");
  const history=game.history(),turn=game.turn(),aiColor:Color=humanColor==="w"?"b":"w";
  const legalTargets=useMemo(()=>new Set<Square>(selected?game.moves({square:selected,verbose:true}).map((move)=>move.to):[]),[game,selected]);
  const files=orientation==="w"?FILES:[...FILES].reverse(),ranks=orientation==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  const timedOut=clockPreset!=="none"&&timeLeft[turn]===0?turn:null;
  const timed=clockPreset!=="none",finished=game.isGameOver()||timedOut!==null,paused=timed&&history.length>0&&!clockRunning&&!finished;
  const locked=finished||paused||aiThinking||(mode==="ai"&&turn!==humanColor);
  const timedRef=useRef(timed);

  useEffect(()=>{gameRef.current=game},[game]);
  useEffect(()=>{timedRef.current=timed},[timed]);
  useEffect(()=>{
    const worker=new Worker("/stockfish/stockfish.js#/stockfish/stockfish.wasm");
    workerRef.current=worker;
    worker.onmessage=(event)=>{
      const line=String(event.data);
      if(line==="uciok"){worker.postMessage("setoption name Hash value 16");worker.postMessage("isready")}
      if(line==="readyok")setEngineReady(true);
      if(!line.startsWith("bestmove "))return;
      const moveText=line.split(/\s+/)[1];
      setAiThinking(false);
      if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moveText)||gameRef.current.fen()!==pendingFenRef.current)return;
      const next=copyGame(gameRef.current),move=next.move({from:moveText.slice(0,2) as Square,to:moveText.slice(2,4) as Square,promotion:(moveText[4]||"q") as PieceSymbol});
      setLastMove({from:move.from,to:move.to});
      setSelected(null);
      gameRef.current=next;
      setGame(next);
      if(timedRef.current)setClockRunning(true);
    };
    worker.postMessage("uci");
    return()=>{worker.postMessage("quit");worker.terminate();workerRef.current=null};
  },[]);
  useEffect(()=>{
    if(mode!=="ai"||!engineReady||finished||paused||turn!==aiColor||aiThinking)return;
    const worker=workerRef.current;
    if(!worker)return;
    const config=ENGINE_LEVELS[engineLevel],fen=game.fen();
    pendingFenRef.current=fen;
    setSelected(null);
    setAiThinking(true);
    worker.postMessage(`setoption name Skill Level value ${config.skill}`);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go movetime ${config.moveTime}`);
  },[aiColor,aiThinking,engineLevel,engineReady,finished,game,mode,paused,turn]);
  useEffect(()=>{if(!timed||!clockRunning||finished)return;const active=game.turn(),timer=window.setInterval(()=>setTimeLeft((current)=>({...current,[active]:Math.max(0,current[active]-1)})),1000);return()=>window.clearInterval(timer)},[clockRunning,finished,game,timed]);
  useEffect(()=>{if(!message)return;const timer=window.setTimeout(()=>setMessage(""),2200);return()=>window.clearTimeout(timer)},[message]);

  const selectSquare=(square:Square)=>{
    if(locked)return;
    const piece=game.get(square);
    if(selected&&legalTargets.has(square)){
      const next=copyGame(game),move=next.move({from:selected,to:square,promotion:"q"});
      setLastMove({from:move.from,to:move.to});
      setSelected(null);
      gameRef.current=next;
      setGame(next);
      if(timed)setClockRunning(true);
      return;
    }
    setSelected(piece?.color===turn?square:null);
  };
  const configureClock=(preset:ClockPreset)=>{if(history.length)return;setClockPreset(preset);setTimeLeft(initialClock(preset));setClockRunning(false)};
  const restart=(nextMode=mode,nextHuman=humanColor)=>{workerRef.current?.postMessage("stop");setMode(nextMode);setHumanColor(nextHuman);setOrientation(nextMode==="ai"?nextHuman:"w");const next=new Chess();gameRef.current=next;setGame(next);setLastMove(null);setSelected(null);setTimeLeft(initialClock(clockPreset));setClockRunning(false);setAiThinking(false);setMessage("")};
  const undo=()=>{workerRef.current?.postMessage("stop");const next=copyGame(game);let move=next.undo();if(!move)return;if(mode==="ai"&&next.history().length)move=next.undo()??move;gameRef.current=next;setGame(next);setLastMove(null);setSelected(null);setAiThinking(false);if(timedOut||!next.history().length)setClockRunning(false)};
  const exportPgn=()=>{if(!history.length)return;const exported=copyGame(game),result=timedOut?timedOut==="w"?"0-1":"1-0":game.isCheckmate()?turn==="w"?"0-1":"1-0":game.isDraw()?"1/2-1/2":"*";exported.setHeader("Event","NOVA 本地对局");exported.setHeader("Date",new Date().toISOString().slice(0,10).replace(/-/g,"."));exported.setHeader("Result",result);const url=URL.createObjectURL(new Blob([exported.pgn({newline:"\n",maxWidth:88})],{type:"application/x-chess-pgn;charset=utf-8"})),link=document.createElement("a");link.href=url;link.download=`NOVA-对局-${new Date().toISOString().slice(0,10)}.pgn`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("PGN 已导出")};
  const importPgn=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;try{workerRef.current?.postMessage("stop");const next=new Chess();next.loadPgn(await file.text());const moves=next.history({verbose:true}),last=moves[moves.length-1];gameRef.current=next;setGame(next);setMode("local");setSelected(null);setLastMove(last?{from:last.from,to:last.to}:null);setTimeLeft(initialClock(clockPreset));setClockRunning(false);setAiThinking(false);setMessage(`${file.name} 已导入，本局切换为双人`)}catch{setMessage("无法读取该 PGN 文件")}};
  const status=timedOut?`${colorName(timedOut==="w"?"b":"w")}胜 · ${colorName(timedOut)}超时`:game.isCheckmate()?`${colorName(turn)}被将死`:game.isDraw()?"和棋":aiThinking?"Stockfish 正在思考":!engineReady&&mode==="ai"?"正在加载 Stockfish":paused?`${colorName(turn)}走 · 已暂停`:`${colorName(turn)}走${game.isCheck()?" · 将军":""}`;

  return <main className="chess-game">
    <header className="chess-toolbar">
      <div className="chess-status"><strong>{mode==="ai"?"对战 Stockfish":"本地双人"}</strong><span className={game.isCheck()||timedOut?"check":""}>{message||status}</span></div>
      <div className="chess-mode-controls">
        <select aria-label="对局模式" value={mode} onChange={(event)=>restart(event.target.value as GameMode,humanColor)}><option value="ai">人机对战</option><option value="local">本地双人</option></select>
        {mode==="ai"&&<><select aria-label="AI 强度" value={engineLevel} onChange={(event)=>setEngineLevel(event.target.value as EngineLevel)}>{Object.entries(ENGINE_LEVELS).map(([value,config])=><option key={value} value={value}>{config.label}</option>)}</select><select aria-label="玩家执棋" value={humanColor} onChange={(event)=>restart("ai",event.target.value as Color)}><option value="w">玩家执白</option><option value="b">玩家执黑</option></select></>}
      </div>
      <div className="chess-actions">
        <button aria-label="查看国际象棋规则" title="规则" onClick={()=>setRulesOpen(true)}>?</button>
        {timed&&<button aria-label={clockRunning?"暂停棋钟":"继续棋钟"} title={clockRunning?"暂停棋钟":"继续棋钟"} disabled={!history.length||finished} onClick={()=>{setClockRunning(!clockRunning);setSelected(null)}}>{clockRunning?"Ⅱ":"▶"}</button>}
        <input ref={importRef} className="chess-pgn-input" type="file" accept=".pgn,text/plain" aria-label="导入 PGN 棋谱" onChange={importPgn}/>
        <button aria-label="导入 PGN" title="导入 PGN" onClick={()=>importRef.current?.click()}>⇧</button>
        <button aria-label="导出 PGN" title="导出 PGN" disabled={!history.length} onClick={exportPgn}>⇩</button>
        <button aria-label="悔棋" title="悔棋" disabled={!history.length||aiThinking} onClick={undo}>↶</button>
        <button aria-label="翻转棋盘" title="翻转棋盘" onClick={()=>setOrientation(orientation==="w"?"b":"w")}>⇅</button>
        <button aria-label="重新开始" title="重新开始" onClick={()=>restart()}>↻</button>
      </div>
    </header>
    <div className="chess-clock-modes" role="group" aria-label="棋钟模式">{(Object.entries(CLOCK_PRESETS) as [ClockPreset,{label:string;seconds:number}][]).map(([preset,config])=><button key={preset} className={clockPreset===preset?"active":""} aria-pressed={clockPreset===preset} disabled={history.length>0} onClick={()=>configureClock(preset)}>{config.label}</button>)}</div>
    <section className="chess-layout">
      <div className="chess-board" role="grid" aria-label="国际象棋棋盘">{ranks.flatMap((rank,rowIndex)=>files.map((file,columnIndex)=>{const square=`${file}${rank}` as Square,piece=game.get(square),legal=legalTargets.has(square),isLast=lastMove?.from===square||lastMove?.to===square;return <button role="gridcell" key={square} aria-label={`${square}${piece?`，${piece.color==="w"?"白方":"黑方"}${PIECE_NAMES[piece.type]}`:"，空格"}`} className={`chess-square ${(rowIndex+columnIndex)%2?"dark":"light"} ${selected===square?"selected":""} ${legal?"legal":""} ${legal&&piece?"capture":""} ${isLast?"last":""}`} onClick={()=>selectSquare(square)}>{piece&&<span className={`chess-piece ${piece.color==="w"?"white":"black"}`}>{PIECES[piece.color][piece.type]}</span>}{columnIndex===0&&<small className="rank-label">{rank}</small>}{rowIndex===7&&<small className="file-label">{file}</small>}</button>}))}</div>
      <aside className="chess-sidebar">
        <div className={`chess-clock black ${timed&&clockRunning&&turn==="b"&&!finished?"active":""} ${timedOut==="b"?"expired":""}`}><span>黑方</span><strong>{timed?formatClock(timeLeft.b):"∞"}</strong></div>
        <div className="chess-moves"><header><strong>对局记录</strong><span>{Math.ceil(history.length/2)} 回合</span></header><div>{history.length?Array.from({length:Math.ceil(history.length/2)},(_,index)=><p key={index}><b>{index+1}.</b><span>{history[index*2]}</span><span>{history[index*2+1]??""}</span></p>):<div className="chess-empty">{mode==="ai"&&!engineReady?"引擎加载中":"等待白方走棋"}</div>}</div></div>
        <div className={`chess-clock white ${timed&&clockRunning&&turn==="w"&&!finished?"active":""} ${timedOut==="w"?"expired":""}`}><span>白方</span><strong>{timed?formatClock(timeLeft.w):"∞"}</strong></div>
      </aside>
    </section>
    {rulesOpen&&<section className="game-rules" role="dialog" aria-modal="true" aria-label="国际象棋规则"><div><header><strong>国际象棋规则</strong><button aria-label="关闭规则" onClick={()=>setRulesOpen(false)}>×</button></header><article><h3>目标</h3><p>将对方的王置于无法解除的攻击中即为将死。王被攻击时必须立即应将。</p><h3>棋子走法</h3><dl><dt>王</dt><dd>每次向任意方向走一格；符合条件时可与车进行王车易位。</dd><dt>后</dt><dd>沿横、竖或斜线走任意格。</dd><dt>车 / 象</dt><dd>车沿横竖线，象沿斜线走任意格。</dd><dt>马</dt><dd>走“日”字且可以越子。</dd><dt>兵</dt><dd>向前走、斜向吃子；首步可走两格，到达底线后升变。</dd></dl><h3>特殊规则</h3><p>支持王车易位、吃过路兵、兵升变、三次重复、五十回合规则及子力不足和棋。所有合法性由 chess.js 校验，电脑对手由 Stockfish 18 驱动。</p></article></div></section>}
  </main>
}
