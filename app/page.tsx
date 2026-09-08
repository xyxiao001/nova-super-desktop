"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { APP_COMPONENTS, APP_REGISTRY, type WindowAppId } from "../src/platform/apps/appRegistry";
import { standaloneAppRoute } from "./standaloneAppRoute";
import type { GameId } from "../src/apps/games/shared/gameStorage";
const DesktopRoot = lazy(() => import("../src/shell/DesktopRoot"));
const GamePage = lazy(() => import("../src/apps/games/GamePage"));

import { GAME_CATALOG } from "../src/apps/games/gameCatalog";

export default function Home() {
  const [route,setRoute]=useState<{game:GameId|null;app:WindowAppId|null}>();
  useEffect(()=>{setRoute({game:GAME_CATALOG.find(game=>game.id===new URLSearchParams(location.search).get("game"))?.id ?? null,app:standaloneAppRoute(location.search)})},[]);
  useEffect(()=>{if(!route?.app)return;const title=document.title;document.title=`${APP_REGISTRY[route.app].label} · NOVA`;return()=>{document.title=title}},[route?.app]);
  if (route === undefined) return null;
  const CyberCityApp=APP_COMPONENTS.cybercity;
  return <Suspense fallback={null}>{route.app === "cybercity" ? <div style={{height:"100dvh"}}><CyberCityApp/></div> : route.app ? <DesktopRoot initialApp={route.app}/> : route.game ? <GamePage gameId={route.game} /> : <DesktopRoot />}</Suspense>;
}
