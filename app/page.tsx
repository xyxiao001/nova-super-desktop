"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import type { GameId } from "../src/apps/games/shared/gameStorage";
const DesktopRoot = lazy(() => import("../src/shell/DesktopRoot"));
const GamePage = lazy(() => import("../src/apps/games/GamePage"));

import { GAME_CATALOG } from "../src/apps/games/gameCatalog";

export default function Home() {
  const [game,setGame]=useState<GameId | null>();
  useEffect(()=>{setGame(GAME_CATALOG.find(game=>game.id===new URLSearchParams(location.search).get("game"))?.id ?? null)},[]);
  if (game === undefined) return null;
  return <Suspense fallback={null}>{game ? <GamePage gameId={game} /> : <DesktopRoot />}</Suspense>;
}
