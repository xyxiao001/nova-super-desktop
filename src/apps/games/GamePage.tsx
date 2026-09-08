"use client";

import { Suspense, useReducer, useState } from 'react';
import { APP_COMPONENTS, type WindowAppId } from '../../platform/apps/appRegistry';
import { WindowInstanceProvider, WindowRuntimeProvider, notifyWindowClosing } from '../../platform/windows/WindowRuntime';
import { singletonWindowInstanceId, windowInstanceReducer, type WindowInstanceId, type WindowInstanceTarget } from '../../platform/windows/windowInstanceState';
import GameLanding from './GameLanding';
import { GAME_CATALOG } from './gameCatalog';
import type { GameId } from './shared/gameStorage';

export default function GamePage({gameId}: {gameId: GameId}) {
 const [playing,setPlaying]=useState(false);
 const id=singletonWindowInstanceId(gameId);
 const [manager,dispatch]=useReducer(windowInstanceReducer,{instances:{[id]:{id,app:gameId,minimized:false,maximized:true,z:1}},focused:id,nextZ:2});
 const game=GAME_CATALOG.find(game=>game.id===gameId)!;
 const Game=APP_COMPONENTS[gameId];
 const open=(app:WindowAppId,target?:WindowInstanceTarget)=>{const next=singletonWindowInstanceId(app);dispatch({type:'open',id:next,app,target});return next;};
 const close=(target:WindowInstanceId)=>{notifyWindowClosing(target);location.href='/';};
 if(!playing)return <GameLanding gameId={gameId} onStart={()=>setPlaying(true)}/>;
 return <WindowRuntimeProvider value={{instances:manager.instances,focused:manager.focused,openApp:open,openNewWindow:open,openResource:open,
  retargetInstance:(id,target)=>{dispatch({type:'retarget',id,target});return id;},focusInstance:id=>dispatch({type:'focus',id}),closeInstance:close,
  isAppOpen:app=>app===gameId,isAppActive:app=>app===gameId,isInstanceActive:target=>target===id,
  setWindowTitle:(id,title)=>dispatch({type:'update',id,patch:{title}})}}>
  <WindowInstanceProvider value={{id,app:gameId}}>
   <main className="game-player" aria-label={`${game.label}全窗口游戏`}>
    <header className="game-player-bar"><strong>{game.label}</strong><a href="/" onClick={()=>notifyWindowClosing(id)}>返回桌面 ↗</a></header>
    <div className="game-player-surface"><Suspense fallback={<p role="status">正在加载游戏…</p>}><Game/></Suspense></div>
   </main>
  </WindowInstanceProvider>
 </WindowRuntimeProvider>;
}
