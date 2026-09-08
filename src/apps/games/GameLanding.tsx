import { GAME_CATALOG } from './gameCatalog';
import type { GameId } from './shared/gameStorage';
import './gameLanding.css';

export default function GameLanding({gameId,onStart}:{gameId:GameId;onStart:()=>void}) {
 const game=GAME_CATALOG.find(game=>game.id===gameId)!;
 const frontline=gameId==='frontline';
 return <main className={`game-landing ${frontline?'frontline-landing':''}`} aria-label={`${game.label}游戏介绍`}>
  <div className="game-landing-backdrop" style={{backgroundImage:`url("${game.artwork}")`}} aria-hidden="true"/>
  <header className="game-landing-nav"><a className="game-landing-brand" href="/">NOVA <span>PLAY / 本地游戏</span></a><a href="/">返回桌面 ↗</a></header>
  <section className="game-landing-card">
   <div className="game-landing-art"><img className="game-landing-cover" src={game.artwork} alt={game.label}/><span className="game-art-caption">{frontline?'烈日沙漠 · 远征起点':game.category+' · 随时开局'}</span></div>
   <div className="game-landing-content"><p className="game-landing-category">{game.category} / 即点即玩</p><h1>{game.label}</h1><p className="game-landing-meta">{game.meta}</p><p className="game-landing-description">{frontline?'选择你的领主，集结英雄。在蜿蜒的沙漠战线上，部署属于你的胜利。':'留一点时间给下一局。打开游戏，在熟悉的规则里迎接新的挑战。'}</p><div className="game-landing-facts"><span>{frontline?'300 关自由挑战':'全窗口游玩'}</span><span>本地存档</span><span>{frontline?'鼠标点选指挥':'即开即玩'}</span></div><button onClick={onStart}>开始游戏 <span aria-hidden="true">↗</span></button><p className="game-landing-note">直接进入全窗口游戏 · 随时返回桌面<br/>进度保存在当前设备，分享链接不包含存档。</p></div>
  </section>
  <footer className="game-landing-footer"><span>NOVA / PLAY YOUR WAY</span><span>你的设备，你的游戏进度。</span></footer>
 </main>;
}
