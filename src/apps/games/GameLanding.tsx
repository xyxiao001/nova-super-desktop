import { GAME_CATALOG } from './gameCatalog';
import type { GameId } from './shared/gameStorage';
import './gameLanding.css';

export default function GameLanding({gameId,onStart}:{gameId:GameId;onStart:()=>void}) {
 const game=GAME_CATALOG.find(game=>game.id===gameId)!;
 return <main className="game-landing" aria-label={`${game.label}游戏介绍`}>
  <a className="game-landing-brand" href="/">NOVA <span>本地游戏</span></a>
  <section className="game-landing-card">
   <img className="game-landing-cover" src={game.artwork} alt={game.label}/>
   <div className="game-landing-content"><p className="game-landing-category">{game.category} · 即点即玩</p><h1>{game.label}</h1><p className="game-landing-meta">{game.meta}</p><button onClick={onStart}>开始游戏 <span aria-hidden="true">→</span></button><p className="game-landing-note">进度保存在当前设备。分享链接不会包含你的存档。</p><a href="/">返回 NOVA 桌面</a></div>
  </section>
 </main>;
}
