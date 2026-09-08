"use client";

import { useEffect, useState } from "react";
import type { GameId } from "../src/apps/games/shared/gameStorage";
import DesktopRoot from "../src/shell/DesktopRoot";

import { GAME_CATALOG } from "../src/apps/games/gameCatalog";

export default function Home() {
  const [game,setGame]=useState<GameId>();
  useEffect(()=>{setGame(GAME_CATALOG.find(game=>game.id===new URLSearchParams(location.search).get("game"))?.id)},[]);
  return <DesktopRoot landingGame={game} />;
}
