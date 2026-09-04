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
import type { BattleCommand } from "./BattleCanvas";
import {
  createBattle,
  strengthenCost,
  summonCost,
  type BattleState,
} from "./frontlineCore";
import FrontlineCampaign from "./FrontlineCampaign";
import { loadFirstLevel } from "./frontlineLevel";
import FrontlineHeroes from "./FrontlineHeroes";
import FrontlineLord from "./FrontlineLord";
import FrontlineRecruit, {
  type FrontlineRecruitState,
} from "./FrontlineRecruit";
import {
  FRONTLINE_HERO_BY_ID,
  FRONTLINE_HEROES,
  type FrontlineHeroId,
  type FrontlineHeroRoster,
} from "./frontlineRoster";

type FrontlineProgress = {
  version: 3;
  sourceVersion: string;
  unlockedLevelId: string;
  completedLevelIds: string[];
  stars: Record<string, 0 | 1 | 2 | 3>;
  bestBaseHp: Record<string, number>;
  heroes: FrontlineHeroRoster;
  lineup: FrontlineHeroId[];
  lord: { power: number; gearLevel: number };
  recruit: FrontlineRecruitState;
};

type LegacyFrontlineProgress = Omit<FrontlineProgress, "version" | "recruit"> & {
  version: 2;
};

type Screen = "map" | "heroes" | "lord" | "recruit" | "loading" | "battle" | "error";
type PendingBattleCommand =
  | { type: "summon"; heroId: string }
  | { type: "strengthen" };

const SOURCE_VERSION = "412f11e3c27d645ddeafcf921f558d57";
const CAMPAIGN_POWER = 1182;
const DEFAULT_PROGRESS: FrontlineProgress = {
  version: 3,
  sourceVersion: SOURCE_VERSION,
  unlockedLevelId: "desert-1",
  completedLevelIds: [],
  stars: {},
  bestBaseHp: {},
  heroes: {
    lightning: { level: 9, attack: 2060, pieces: 0, material: 400 },
    jinx: { level: 6, attack: 1819, pieces: 0, material: 1021 },
    summoner: { level: 5, attack: 1739, pieces: 0, material: 278 },
    clown: { level: 6, attack: 1819, pieces: 0, material: 46 },
  },
  lineup: ["summoner", "clown", "jinx", "lightning"],
  lord: { power: 1178, gearLevel: 18 },
  recruit: { tickets: 8, experience: 996, exchangeProgress: 90 },
};
const ASSET_ROOT = "/assets/games/frontline";

const loadProgress = () => {
  const saved = loadGameProgress<FrontlineProgress | LegacyFrontlineProgress>("frontline");
  if (saved?.version === 3) return saved;
  if (saved?.version === 2) {
    return {
      ...saved,
      version: 3,
      recruit: DEFAULT_PROGRESS.recruit,
    } satisfies FrontlineProgress;
  }
  return DEFAULT_PROGRESS;
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
  const [battleCommand, setBattleCommand] = useState<BattleCommand | null>(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [initialHeroFormation, setInitialHeroFormation] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const battleCommandSequence = useRef(0);

  useEffect(() => {
    touchGame("frontline");
    return subscribeGameReset("frontline", () => {
      setProgress(DEFAULT_PROGRESS);
      setInitialBattle(null);
      setSnapshot(null);
      setBattleCommand(null);
      setShowStatistics(false);
      setInitialHeroFormation(false);
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
      const level = await loadFirstLevel(progress.lineup, progress.heroes);
      const battle = createBattle(level.battle);
      setInitialBattle(battle);
      setSnapshot(battle);
      setPaused(false);
      setSpeed(1);
      setBattleCommand(null);
      setShowStatistics(false);
      setScreen("battle");
      void audioRef.current?.play();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "第一关资源加载失败");
      setScreen("error");
    }
  }, [progress.heroes, progress.lineup]);

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
        ? snapshot.baseHp === snapshot.config.economy.baseHp ? 3 : 2
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
    setBattleCommand(null);
    setShowStatistics(false);
    setPaused(false);
    setScreen("map");
  }, [snapshot]);

  const towerSlots = initialBattle?.config.towerSlots ?? [];
  const occupiedSlots = useMemo(
    () => new Set(snapshot?.defenders.flatMap((defender) => (
      defender.slotIndex === null ? [] : [defender.slotIndex]
    )) ?? []),
    [snapshot],
  );

  const upgradeHero = useCallback((hero: (typeof FRONTLINE_HEROES)[number]) => {
    setProgress((current) => {
      const state = current.heroes[hero.id];
      if (state.material < hero.materialCost) return current;
      return {
        ...current,
        heroes: {
          ...current.heroes,
          [hero.id]: {
            ...state,
            level: state.level + 1,
            attack: state.attack + 80,
            material: state.material - hero.materialCost,
          },
        },
      };
    });
  }, []);

  const toggleLineup = useCallback((id: FrontlineHeroId) => {
    setProgress((current) => ({
      ...current,
      lineup: current.lineup.includes(id)
        ? current.lineup.filter((heroId) => heroId !== id)
        : [...current.lineup, id].slice(-4),
    }));
  }, []);

  const upgradeLord = useCallback(() => {
    setProgress((current) => ({
      ...current,
      lord: {
        power: current.lord.power + 24,
        gearLevel: current.lord.gearLevel + 1,
      },
    }));
  }, []);

  const recruitHeroes = useCallback((heroIds: FrontlineHeroId[]) => {
    setProgress((current) => {
      if (current.recruit.tickets < heroIds.length) return current;
      const heroes = { ...current.heroes };
      for (const id of heroIds) {
        heroes[id] = {
          ...heroes[id],
          pieces: heroes[id].pieces + 1,
        };
      }
      return {
        ...current,
        heroes,
        recruit: {
          tickets: current.recruit.tickets - heroIds.length,
          experience: Math.min(1200, current.recruit.experience + heroIds.length),
          exchangeProgress: Math.min(
            100,
            current.recruit.exchangeProgress + heroIds.length,
          ),
        },
      };
    });
  }, []);

  const sendBattleCommand = useCallback((
    command: PendingBattleCommand,
  ) => {
    battleCommandSequence.current += 1;
    setBattleCommand({
      ...command,
      sequence: battleCommandSequence.current,
    } as BattleCommand);
  }, []);

  const summonRandomHero = useCallback(() => {
    if (!snapshot || progress.lineup.length === 0) return;
    const deployed = new Set(
      snapshot.defenders
        .filter((defender) => defender.kind === "hero")
        .map((defender) => defender.actorId),
    );
    const lineup = progress.lineup
      .map((id) => FRONTLINE_HERO_BY_ID.get(id))
      .filter((hero) => hero !== undefined);
    const undeployed = lineup.filter((hero) => !deployed.has(hero.actorId));
    const pool = undeployed.length > 0 ? undeployed : lineup;
    const hero = pool[Math.floor(Math.random() * pool.length)];
    if (hero) sendBattleCommand({ type: "summon", heroId: hero.actorId });
  }, [progress.lineup, sendBattleCommand, snapshot]);

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
          <FrontlineCampaign
            stars={progress.stars["desert-1"] ?? 0}
            power={CAMPAIGN_POWER}
            roster={progress.heroes}
            lineup={progress.lineup}
            onEditLineup={() => {
              setInitialHeroFormation(true);
              setScreen("heroes");
            }}
            onOpenRecruit={() => setScreen("recruit")}
            onStartLevel={startLevel}
          />
        )}

        {screen === "loading" && (
          <div className="frontline-loading" role="status">
            <span />
            <strong>正在部署战场</strong>
          </div>
        )}

        {screen === "heroes" && (
          <FrontlineHeroes
            roster={progress.heroes}
            lineup={progress.lineup}
            initialFormation={initialHeroFormation}
            onUpgrade={upgradeHero}
            onToggleLineup={toggleLineup}
          />
        )}

        {screen === "lord" && (
          <FrontlineLord
            power={progress.lord.power}
            gearLevel={progress.lord.gearLevel}
            onUpgrade={upgradeLord}
          />
        )}

        {screen === "recruit" && (
          <FrontlineRecruit
            {...progress.recruit}
            onRecruit={recruitHeroes}
          />
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
              command={battleCommand}
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
                <b>{snapshot.baseHp}/{snapshot.config.economy.baseHp}</b>
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
              <button
                type="button"
                aria-label="查看战斗统计"
                onClick={() => {
                  setPaused(true);
                  setShowStatistics(true);
                }}
              >
                ▤
              </button>
            </div>
            <div className="battle-command-bar">
              <button
                type="button"
                className="strengthen"
                onClick={() => sendBattleCommand({ type: "strengthen" })}
                disabled={
                  snapshot.summonCount < snapshot.config.economy.strengthenUnlockSummons
                  || snapshot.coins < strengthenCost(snapshot)
                }
              >
                <img src={`${ASSET_ROOT}/strengthen.png`} alt="" />
                <strong>强化</strong>
                <span>{strengthenCost(snapshot)}</span>
              </button>
              <div>
                <span>银币</span>
                <strong>{Math.floor(snapshot.coins)}</strong>
              </div>
              <button
                type="button"
                className="summon"
                onClick={summonRandomHero}
                disabled={
                  snapshot.coins < summonCost(snapshot)
                  || occupiedSlots.size >= towerSlots.filter((slot) => slot.state === "deployable").length
                }
              >
                <img src={`${ASSET_ROOT}/summon.png`} alt="" />
                <strong>召唤</strong>
                <span>{summonCost(snapshot)}</span>
              </button>
            </div>
            <footer className="battle-status">
              <div><span>强化</span><strong>Lv.{snapshot.strengthenLevel}</strong></div>
              <div><span>已召唤</span><strong>{snapshot.summonCount}/7</strong></div>
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
            {showStatistics && rendererReady && (
              <div className="frontline-dialog battle-statistics" role="dialog" aria-modal="true">
                <strong>战斗统计</strong>
                <div>
                  {snapshot.defenders.map((defender) => (
                    <p key={defender.id}>
                      <span>{defender.name}</span>
                      <b>{Math.round(defender.damageDealt)}</b>
                    </p>
                  ))}
                </div>
                <button type="button" onClick={() => {
                  setShowStatistics(false);
                  setPaused(false);
                }}>返回战斗</button>
              </div>
            )}
            {!showStatistics && (paused || snapshot.status === "won" || snapshot.status === "lost") && rendererReady && (
              <div className="frontline-dialog" role="dialog" aria-modal="true">
                <strong>
                  {paused
                    ? "战斗暂停"
                    : snapshot.status === "won"
                      ? "守卫成功"
                      : "水晶失守"}
                </strong>
                {snapshot.status !== "active" && (
                  <span>水晶生命 {snapshot.baseHp}/{snapshot.config.economy.baseHp}</span>
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


        {(screen === "map" || screen === "heroes" || screen === "lord" || screen === "recruit") && (
          <nav className="frontline-main-nav" aria-label="游戏主导航">
            <button type="button" className={screen === "map" ? "active" : ""} onClick={() => setScreen("map")}><span>⚔</span>战役</button>
            <button
              type="button"
              className={screen === "heroes" ? "active" : ""}
              onClick={() => {
                setInitialHeroFormation(false);
                setScreen("heroes");
              }}
            ><span>✦</span>英雄</button>
            <button type="button" className={screen === "lord" ? "active" : ""} onClick={() => setScreen("lord")}><span>♛</span>领主</button>
            <button type="button" className={screen === "recruit" ? "active" : ""} onClick={() => setScreen("recruit")}><span>▣</span>招募</button>
          </nav>
        )}
      </section>
    </main>
  );
}
