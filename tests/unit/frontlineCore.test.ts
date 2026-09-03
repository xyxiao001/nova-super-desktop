import { describe, expect, it } from "vitest";
import {
  createBattle,
  FIXED_STEP_SECONDS,
  pathPosition,
  setBattlePaused,
  stepBattle,
  type BattleConfig,
} from "../../src/apps/frontline/frontlineCore";

const createConfig = (
  hitTimeSeconds: number | null = 0.1,
): BattleConfig => ({
  levelId: "desert-1",
  path: [{ x: 0, y: 0 }, { x: 1200, y: 0 }],
  towerSlots: [
    { index: 0, state: "deployable", priority: 0, position: { x: 120, y: 0 } },
  ],
  heroes: [{
    id: "hero-01-fashi",
    name: "魔法师",
    baseAttack: 40,
    damageCoefficient: 100,
    cooldownMs: 1600,
    range: 300,
    animationDurationSeconds: 0.4,
    hitTimeSeconds,
  }],
  waves: [{
    wave: 1,
    waitTimeMs: 0,
    leftMonsterNextWave: 0,
    totalMonsterCount: 2,
    spawnGroups: [{
      id: 253,
      waitTimeMs: 0,
      intervalMs: 1000,
      count: 2,
      pathOffsetType: 0,
      monster: {
        id: 1001,
        name: "沙漠蜥蜴",
        moveSpeed: 10,
        hpScale: 1,
        crystalDamage: 1,
      },
    }],
  }],
});

const stepTicks = (count: number, config = createConfig()) => {
  let battle = createBattle(config);
  for (let index = 0; index < count; index += 1) {
    battle = stepBattle(battle);
  }
  return battle;
};

describe("frontlineCore", () => {
  it("uses the manifest path by arc length", () => {
    expect(pathPosition(
      [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }],
      50,
    )).toEqual({ x: 30, y: 20 });
  });

  it("spawns configured groups on a fixed 60Hz clock", () => {
    const battle = stepTicks(61);
    expect(battle.tick).toBe(61);
    expect(battle.groupSpawned[253]).toBe(2);
    expect(battle.enemies).toHaveLength(2);
  });

  it("does not treat a zero wave timeout as an immediate advance", () => {
    const config = createConfig(null);
    config.waves[0].leftMonsterNextWave = 1;
    config.waves.push({
      ...config.waves[0],
      wave: 2,
      spawnGroups: [{
        ...config.waves[0].spawnGroups[0],
        id: 254,
      }],
    });

    const battle = stepTicks(61, config);

    expect(battle.enemies).toHaveLength(2);
    expect(battle.waveIndex).toBe(0);
  });

  it("applies damage only after a confirmed external hit frame", () => {
    const beforeHit = stepTicks(6);
    expect(beforeHit.enemies[0].hp).toBe(100);
    const afterHit = stepBattle(stepBattle(beforeHit));
    expect(afterHit.enemies[0].hp).toBe(60);
  });

  it("does not invent a hit event when timing is unresolved", () => {
    const battle = stepTicks(120, createConfig(null));
    expect(battle.enemies[0].hp).toBe(100);
  });

  it("freezes the simulation while paused", () => {
    const battle = stepTicks(10);
    const paused = setBattlePaused(battle, true);
    expect(stepBattle(paused)).toBe(paused);
  });

  it("is deterministic for the same number of fixed ticks", () => {
    expect(stepTicks(180)).toEqual(stepTicks(180));
  });
});
