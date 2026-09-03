"use client";

import "./frontline.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadGameProgress,
  saveGameProgress,
  subscribeGameReset,
  touchGame,
} from "../games/shared/gameStorage";
import BattleCanvas from "./BattleCanvas";
import {
  createBattle,
  type BattleState,
} from "./frontlineCore";
import { loadFirstLevel } from "./frontlineLevel";

type FrontlineProgress = {
  version: 1;
  sourceVersion: string;
  unlockedLevelId: string;
  completedLevelIds: string[];
  stars: Record<string, 0 | 1 | 2 | 3>;
  bestBaseHp: Record<string, number>;
};

type Screen = "map" | "loading" | "battle" | "error";

const SOURCE_VERSION = "412f11e3c27d645ddeafcf921f558d57";
const DEFAULT_PROGRESS: FrontlineProgress = {
  version: 1,
  sourceVersion: SOURCE_VERSION,
  unlockedLevelId: "desert-1",
  completedLevelIds: [],
  stars: {},
  bestBaseHp: {},
};
const ASSET_ROOT = "/assets/games/frontline";

const loadProgress = () => {
  const saved = loadGameProgress<FrontlineProgress>("frontline");
  return saved?.version === 1 ? saved : DEFAULT_PROGRESS;
};

const remainingInWave = (battle: BattleState) => {
  const wave = battle.config.waves[battle.waveIndex];
  const waiting = wave.spawnGroups.reduce(
    (sum, group) => sum + group.count - (battle.groupSpawned[group.id] ?? 0),
    0,
  );
  return waiting + battle.enemies.filter((enemy) => enemy.animation !== "dead").length;
};

export default function FrontlineGame() {
  const [progress, setProgress] = useState(loadProgress);
  const [screen, setScreen] = useState<Screen>("map");
  const [initialBattle, setInitialBattle] = useState<BattleState | null>(null);
  const [snapshot, setSnapshot] = useState<BattleState | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [rendererReady, setRendererReady] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    touchGame("frontline");
    return subscribeGameReset("frontline", () => {
      setProgress(DEFAULT_PROGRESS);
      setInitialBattle(null);
      setSnapshot(null);
      setScreen("map");
      saveGameProgress("frontline", DEFAULT_PROGRESS);
    });
  }, []);

  useEffect(() => {
    saveGameProgress("frontline", progress);
  }, [progress]);

  const startLevel = useCallback(async () => {
    setScreen("loading");
    setError("");
    setRendererReady(false);
    try {
      const level = await loadFirstLevel();
      const battle = createBattle(level.battle);
      setInitialBattle(battle);
      setSnapshot(battle);
      setPaused(false);
      setSpeed(1);
      setScreen("battle");
      void audioRef.current?.play();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "第一关资源加载失败");
      setScreen("error");
    }
  }, []);

  const onSnapshot = useCallback((battle: BattleState) => {
    setSnapshot({ ...battle });
  }, []);
  const onRendererReady = useCallback(() => {
    setRendererReady(true);
  }, []);
  const onRendererError = useCallback((message: string) => {
    setError(message);
    setScreen("error");
  }, []);

  const leaveBattle = useCallback(() => {
    if (snapshot?.status === "won") {
      const stars: 1 | 2 | 3 = snapshot.elapsed <= 220
        ? snapshot.baseHp === 10 ? 3 : 2
        : 1;
      setProgress((current) => ({
        ...current,
        completedLevelIds: current.completedLevelIds.includes("desert-1")
          ? current.completedLevelIds
          : [...current.completedLevelIds, "desert-1"],
        stars: {
          ...current.stars,
          "desert-1": Math.max(current.stars["desert-1"] ?? 0, stars) as 0 | 1 | 2 | 3,
        },
        bestBaseHp: {
          ...current.bestBaseHp,
          "desert-1": Math.max(current.bestBaseHp["desert-1"] ?? 0, snapshot.baseHp),
        },
      }));
    }
    audioRef.current?.pause();
    setInitialBattle(null);
    setSnapshot(null);
    setPaused(false);
    setScreen("map");
  }, [snapshot]);

  const towerSlots = initialBattle?.config.towerSlots ?? [];
  const occupiedSlots = useMemo(
    () => new Set(initialBattle?.defenders.map((defender) => defender.slotIndex) ?? []),
    [initialBattle],
  );

  return (
    <main className="frontline">
      <audio
        ref={audioRef}
        src={`${ASSET_ROOT}/audio/main-bgm-desert.m4a`}
        loop
        preload="none"
      />
      <section className={`frontline-stage ${screen === "map" ? "world-map" : "battle-field"}`}>
        {screen === "map" && (
          <>
            <header className="frontline-map-header">
              <div>
                <small>第一章</small>
                <strong>烈日沙漠</strong>
              </div>
              <output aria-label="章节星级">
                {progress.stars["desert-1"] ?? 0}<span>/3</span>
              </output>
            </header>
            <button
              className="frontline-level-node"
              type="button"
              onClick={startLevel}
              aria-label="进入第一关 烈日沙漠1"
            >
              <b>1-1</b>
              <span>烈日沙漠1</span>
            </button>
            <footer className="frontline-map-command">
              <div>
                <strong>烈日沙漠1</strong>
                <span>6 波 · 推荐战力 1060</span>
              </div>
              <button type="button" onClick={startLevel}>出战</button>
            </footer>
          </>
        )}

        {screen === "loading" && (
          <div className="frontline-loading" role="status">
            <span />
            <strong>正在部署战场</strong>
          </div>
        )}

        {screen === "error" && (
          <div className="frontline-dialog" role="alert">
            <strong>资源校验失败</strong>
            <span>{error}</span>
            <button type="button" onClick={() => setScreen("map")}>返回</button>
          </div>
        )}

        {screen === "battle" && initialBattle && snapshot && (
          <>
            <div className="battle-map" aria-hidden="true" />
            <div className="battle-pedestals" aria-hidden="true">
              {towerSlots.map((slot) => (
                <img
                  key={slot.index}
                  className={slot.state}
                  src={`${ASSET_ROOT}/sprites/map-common/${
                    occupiedSlots.has(slot.index)
                      ? "map_00_dizuo_3.png"
                      : slot.state === "deployable"
                        ? "map_00_dizuo_1.png"
                        : "map_00_dizuo_2.png"
                  }`}
                  alt=""
                  style={{
                    left: `${slot.position.x / 9}%`,
                    top: `${slot.position.y / 16}%`,
                  }}
                />
              ))}
            </div>
            <BattleCanvas
              initialBattle={initialBattle}
              speed={speed}
              paused={paused}
              onSnapshot={onSnapshot}
              onReady={onRendererReady}
              onError={onRendererError}
            />
            <header className="battle-hud">
              <div>
                <small>烈日沙漠1</small>
                <strong>第 {snapshot.waveIndex + 1} / 6 波</strong>
              </div>
              <output>
                <span>剩余</span>
                <b>{remainingInWave(snapshot)}</b>
              </output>
              <output>
                <span>水晶</span>
                <b>{snapshot.baseHp}/10</b>
              </output>
            </header>
            <div className="battle-actions">
              <button
                type="button"
                aria-label={paused ? "继续战斗" : "暂停战斗"}
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? "▶" : "Ⅱ"}
              </button>
              <button
                type="button"
                aria-label="切换战斗速度"
                onClick={() => setSpeed((value) => value === 1 ? 2 : 1)}
              >
                ×{speed}
              </button>
            </div>
            <footer className="battle-status">
              <div>
                <span>已部署</span>
                <strong>{snapshot.defenders.length}/4</strong>
              </div>
              <div>
                <span>战斗时间</span>
                <strong>{Math.floor(snapshot.elapsed / 60)}:{String(Math.floor(snapshot.elapsed % 60)).padStart(2, "0")}</strong>
              </div>
            </footer>
            {!rendererReady && (
              <div className="frontline-loading battle-loading" role="status">
                <span />
                <strong>正在加载原版 Spine</strong>
              </div>
            )}
            {(paused || snapshot.status === "won" || snapshot.status === "lost") && rendererReady && (
              <div className="frontline-dialog" role="dialog" aria-modal="true">
                <strong>
                  {paused
                    ? "战斗暂停"
                    : snapshot.status === "won"
                      ? "守卫成功"
                      : "水晶失守"}
                </strong>
                {snapshot.status !== "active" && (
                  <span>水晶生命 {snapshot.baseHp}/10</span>
                )}
                {paused && snapshot.status === "active" ? (
                  <button type="button" onClick={() => setPaused(false)}>继续</button>
                ) : (
                  <button type="button" onClick={leaveBattle}>返回地图</button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
