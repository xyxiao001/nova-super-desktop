import { describe, expect, it } from "vitest";
import {
  createBattle,
  pathDirection,
  pathPosition,
  setBattlePaused,
  stepBattle,
  strengthenBattle,
  strengthenCost,
  summonCost,
  summonHero,
  type BattleConfig,
  type BattleState,
} from "../../src/apps/frontline/frontlineCore";

const createConfig = (
  hitTimeSeconds: number | null = 0.1,
): BattleConfig => ({
  levelId: "desert-1",
  path: [{ x: 0, y: 0 }, { x: 1200, y: 0 }],
  playerSlot: { x: 60, y: 0 },
  towerSlots: Array.from({ length: 7 }, (_, index) => ({
    index,
    state: "deployable",
    priority: index,
    position: { x: 120 + index * 10, y: 0 },
  })),
  lord: {
    id: "lord-sand-king",
    name: "沙王",
    baseAttack: 1178,
    damageCoefficient: 0,
    cooldownMs: 2000,
    range: 300,
    animationDurationSeconds: 0.4,
    hitTimeSeconds: null,
  },
  heroes: [{
    id: "hero-lightning",
    name: "闪电丘",
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
      coin: 15,
      pathOffsetType: 0,
      monster: {
        id: 1001,
        name: "沙漠蜥蜴",
        moveSpeed: 10,
        hp: 100,
        crystalDamage: 1,
      },
    }],
  }],
  economy: {
    initialCoins: 100,
    baseHp: 20,
    summonCosts: [10, 20, 30, 45, 60, 80, 90],
    strengthenCosts: [100, 200, 300],
    strengthenUnlockSummons: 5,
  },
});

const stepTicks = (battle: BattleState, count: number) => {
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

  it("reports the current path heading for actor facing", () => {
    const path = [{ x: 10, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 20 }];

    expect(pathDirection(path, 5).x).toBeLessThan(0);
    expect(pathDirection(path, 20).x).toBeGreaterThan(0);
  });

  it("starts with Sand King on the player slot and no deployed heroes", () => {
    const battle = createBattle(createConfig());

    expect(battle.defenders).toEqual([
      expect.objectContaining({
        id: 1,
        kind: "lord",
        actorId: "lord-sand-king",
        slotIndex: null,
      }),
    ]);
    expect(battle.coins).toBe(100);
    expect(battle.baseHp).toBe(20);
    expect(battle.summonCount).toBe(0);
  });

  it("spends escalating summon costs and fills deployable slots by priority", () => {
    let battle = createBattle(createConfig());

    expect(summonCost(battle)).toBe(10);
    battle = summonHero(battle, "hero-lightning");
    expect(summonCost(battle)).toBe(20);
    battle = summonHero(battle, "hero-lightning");
    expect(summonCost(battle)).toBe(30);
    battle = summonHero(battle, "hero-lightning");

    expect(battle.coins).toBe(40);
    expect(battle.summonCount).toBe(3);
    expect(battle.defenders.slice(1).map((defender) => defender.slotIndex))
      .toEqual([0, 1, 2]);
  });

  it("does not summon without enough coins or an eligible hero", () => {
    const battle = createBattle(createConfig());
    const poorBattle = { ...battle, coins: 9 };

    expect(summonHero(poorBattle, "hero-lightning")).toBe(poorBattle);
    expect(summonHero(battle, "missing-hero")).toBe(battle);
  });

  it("unlocks strengthening after five summons and charges its configured cost", () => {
    const config = createConfig();
    config.economy.initialCoins = 1000;
    let battle = createBattle(config);
    expect(strengthenBattle(battle)).toBe(battle);

    for (let index = 0; index < 5; index += 1) {
      battle = summonHero(battle, "hero-lightning");
    }
    expect(strengthenCost(battle)).toBe(100);

    const strengthened = strengthenBattle(battle);
    expect(strengthened.coins).toBe(battle.coins - 100);
    expect(strengthened.strengthenLevel).toBe(1);
    expect(strengthened.defenders.slice(1).every(
      (defender) => defender.attack === 44,
    )).toBe(true);
  });

  it("[defect-probing] keeps existing and newly summoned heroes equal after repeated strengthening", () => {
    const config = createConfig();
    config.economy.initialCoins = 1000;
    let battle = createBattle(config);
    for (let index = 0; index < 5; index += 1) {
      battle = summonHero(battle, "hero-lightning");
    }
    battle = strengthenBattle(strengthenBattle(battle));
    battle = summonHero(battle, "hero-lightning");

    const heroes = battle.defenders.filter((defender) => defender.kind === "hero");
    expect(heroes[0].attack).toBeCloseTo(heroes.at(-1)?.attack ?? 0);
  });

  it("spawns configured groups on a fixed 60Hz clock", () => {
    const battle = stepTicks(createBattle(createConfig()), 61);
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

    const battle = stepTicks(createBattle(config), 61);

    expect(battle.enemies).toHaveLength(2);
    expect(battle.waveIndex).toBe(0);
  });

  it("applies damage only after a confirmed external hit frame", () => {
    const deployed = summonHero(createBattle(createConfig()), "hero-lightning");
    const beforeHit = stepTicks(deployed, 6);
    expect(beforeHit.enemies[0].hp).toBe(100);
    const afterHit = stepBattle(stepBattle(beforeHit));
    expect(afterHit.enemies[0].hp).toBe(60);
  });

  it("does not invent a hit event when timing is unresolved", () => {
    const deployed = summonHero(createBattle(createConfig(null)), "hero-lightning");
    const battle = stepTicks(deployed, 120);
    expect(battle.enemies[0].hp).toBe(100);
  });

  it("credits exact damage and configured coins when an enemy dies", () => {
    const config = createConfig();
    config.heroes[0].baseAttack = 100;
    let battle = summonHero(createBattle(config), "hero-lightning");
    battle = stepTicks(battle, 8);

    expect(battle.defenders[1].damageDealt).toBe(100);
    expect(battle.coins).toBe(105);
    expect(battle.enemies[0].animation).toBe("dead");
  });

  it("freezes the simulation while paused", () => {
    const battle = stepTicks(createBattle(createConfig()), 10);
    const paused = setBattlePaused(battle, true);
    expect(stepBattle(paused)).toBe(paused);
  });

  it("is deterministic for the same number of fixed ticks", () => {
    expect(stepTicks(createBattle(createConfig()), 180))
      .toEqual(stepTicks(createBattle(createConfig()), 180));
  });
});
