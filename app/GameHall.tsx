"use client";

export const GAME_CATALOG = [
  {id:"mines",label:"扫雷",category:"逻辑",meta:"经典 · 三档难度"},
  {id:"chess",label:"国际象棋",category:"策略",meta:"Stockfish 18"},
  {id:"gomoku",label:"五子棋",category:"棋类",meta:"Alpha-Beta AI"},
  {id:"go",label:"围棋",category:"棋类",meta:"9 路 · Monte Carlo"},
] as const;

export type GameAppId = (typeof GAME_CATALOG)[number]["id"];

function GameArtwork({id}:{id:GameAppId}){
  if(id==="mines")return <span className="game-artwork mines-artwork" aria-hidden="true"><i/><i/><i/></span>;
  if(id==="chess")return <span className="game-artwork chess-artwork" aria-hidden="true">♞</span>;
  if(id==="gomoku")return <span className="game-artwork gomoku-artwork" aria-hidden="true"><i/><i/><i/></span>;
  return <span className="game-artwork go-artwork" aria-hidden="true"><i/><i/></span>;
}

export default function GameHall({running,onLaunch}:{running:Record<GameAppId,boolean>;onLaunch:(id:GameAppId)=>void}){
  const runningCount=GAME_CATALOG.filter((game)=>running[game.id]).length;

  return <main className="game-hall">
    <header className="game-hall-header">
      <div className="game-hall-brand">
        <span className="game-hall-logo" aria-hidden="true"><i/><i/><i/><i/></span>
        <div><strong>游戏大厅</strong><small>NOVA LOCAL ARCADE</small></div>
      </div>
      <div className="game-hall-status"><b>{runningCount}</b><span>正在运行</span></div>
    </header>
    <section className="game-library" aria-label="本机游戏">
      {GAME_CATALOG.map((game)=><button key={game.id} className={`game-tile ${game.id}-tile`} onClick={()=>onLaunch(game.id)} aria-label={`打开${game.label}`}>
        <div className="game-tile-visual">
          <GameArtwork id={game.id}/>
          <span>{game.category}</span>
        </div>
        <div className="game-tile-info">
          <header><strong>{game.label}</strong>{running[game.id]&&<span>运行中</span>}</header>
          <footer><span>{game.meta}</span><i aria-hidden="true">→</i></footer>
        </div>
      </button>)}
    </section>
    <footer className="game-hall-footer"><span>{GAME_CATALOG.length} 款本机游戏</span><span>离线运行</span></footer>
  </main>
}
