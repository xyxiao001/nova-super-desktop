import { describe, expect, it, vi } from "vitest";
import {
  createBattle,
  closestPathPoint,
  moveLord,
  moveOrMergeDefender,
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
    sourceId: 1,
    name: "沙王",
    baseAttack: 1178,
    damageCoefficient: 0,
    cooldownMs: 2000,
    range: 300,
    animationDurationSeconds: 0.4,
    hitTimeSeconds: null,
  },
  lordMoveSpeed: 200,
  heroes: [
    {
      id: "hero-lightning",
      sourceId: 30001,
      name: "闪电丘",
      baseAttack: 40,
      damageCoefficient: 100,
      cooldownMs: 1600,
      range: 300,
      animationDurationSeconds: 0.4,
      hitTimeSeconds,
    },
    {
      id: "hero-basic-gunner",
      sourceId: 10004,
      name: "矮人炮手",
      baseAttack: 40,
      damageCoefficient: 53,
      cooldownMs: 2400,
      range: 750,
      animationDurationSeconds: 0.5,
      hitTimeSeconds: null,
    },
    {
      id: "hero-basic-ranger",
      sourceId: 10002,
      name: "游侠",
      baseAttack: 40,
      damageCoefficient: 40,
      cooldownMs: 800,
      range: 550,
      animationDurationSeconds: 0.4,
      hitTimeSeconds: null,
    },
  ],
  maxSynthesisStep: 4,
  lightningChain: null,
  synthesisHeroIds: ["hero-lightning"],
  tutorial: {
    fixedSummons: [],
    fixedMerges: [{ heroId: "hero-basic-ranger", step: 2 }],
  },
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

  it("projects lord movement clicks onto the nearest point of the road", () => {
    expect(closestPathPoint(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      { x: 60, y: 30 },
    )).toEqual({ x: 60, y: 0 });
  });

  it("starts with Sand King on the player slot and no deployed heroes", () => {
    const battle = createBattle(createConfig());

    expect(battle.defenders).toEqual([
      expect.objectContaining({
        id: 1,
        kind: "lord",
        actorId: "lord-sand-king",
        slotIndex: null,
        position: { x: 60, y: 0 },
      }),
    ]);
    expect(battle.coins).toBe(100);
    expect(battle.baseHp).toBe(20);
    expect(battle.summonCount).toBe(0);
  });

  it("moves Sand King at the configured speed and resumes combat on arrival", () => {
    let battle = createBattle(createConfig());
    battle = moveLord(battle, { x: 160, y: 0 });
    battle = stepBattle(battle, 0.25);

    expect(battle.defenders[0]).toEqual(expect.objectContaining({
      position: { x: 110, y: 0 },
      moveTarget: { x: 160, y: 0 },
      animation: "run",
    }));

    battle = stepBattle(battle, 0.25);
    expect(battle.defenders[0]).toEqual(expect.objectContaining({
      position: { x: 160, y: 0 },
      moveTarget: null,
      animation: "stand",
    }));
  });

  it("ignores lord movement inside the source 0.4-world-unit dead zone", () => {
    const battle = createBattle(createConfig());
    expect(moveLord(battle, { x: 99, y: 0 })).toBe(battle);
  });

  it("interrupts Sand King's attack when a movement order is issued", () => {
    const config = createConfig();
    config.lord.damageCoefficient = 100;
    config.lord.hitTimeSeconds = 0.1;
    let battle = stepBattle(createBattle(config));
    expect(battle.defenders[0].animation).toBe("attack_1");

    battle = moveLord(battle, { x: 160, y: 0 });
    expect(battle.defenders[0]).toEqual(expect.objectContaining({
      animation: "run",
      targetId: null,
      attackElapsed: 0,
    }));
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

  it("uses the first-level fixed hero and pedestal for tutorial summons", () => {
    const config = createConfig();
    config.tutorial.fixedSummons = [
      { heroId: "hero-basic-gunner", slotIndex: 4, step: 1 },
      { heroId: "hero-basic-gunner", slotIndex: 6, step: 1 },
    ];
    let battle = summonHero(createBattle(config), "hero-lightning");
    battle = summonHero(battle, "hero-lightning");

    expect(battle.defenders.slice(1)).toEqual([
      expect.objectContaining({ sourceId: 10004, slotIndex: 4, step: 1 }),
      expect.objectContaining({ sourceId: 10004, slotIndex: 6, step: 1 }),
    ]);
  });

  it("moves heroes to an empty pedestal and swaps different heroes", () => {
    let battle = summonHero(createBattle(createConfig()), "hero-lightning");
    const firstHeroId = battle.defenders[1].id;
    battle = moveOrMergeDefender(battle, firstHeroId, 3);
    expect(battle.defenders[1].slotIndex).toBe(3);

    battle = summonHero(battle, "hero-basic-gunner");
    const secondHeroId = battle.defenders[2].id;
    battle = moveOrMergeDefender(battle, firstHeroId, battle.defenders[2].slotIndex!);
    expect(battle.defenders.find((defender) => defender.id === firstHeroId)?.slotIndex)
      .toBe(0);
    expect(battle.defenders.find((defender) => defender.id === secondHeroId)?.slotIndex)
      .toBe(3);
  });

  it("merges equal heroes and steps into the fixed first-level result slot", () => {
    let battle = summonHero(createBattle(createConfig()), "hero-basic-gunner");
    battle = summonHero(battle, "hero-basic-gunner");
    const source = battle.defenders[1];
    const target = battle.defenders[2];
    battle = moveOrMergeDefender(battle, source.id, target.slotIndex!);

    expect(battle.synthesisCount).toBe(1);
    expect(battle.defenders.filter((defender) => defender.kind === "hero"))
      .toEqual([expect.objectContaining({
        id: target.id,
        actorId: "hero-basic-ranger",
        sourceId: 10002,
        step: 2,
        slotIndex: target.slotIndex,
      })]);
  });

  it("repeatedly merges matching heroes into the lineup and advances their step", () => {
    const config = createConfig();
    config.tutorial.fixedMerges = [];
    config.economy.initialCoins = 1000;
    config.synthesisHeroIds = ["hero-lightning", "hero-basic-ranger"];
    const random = vi.spyOn(Math, "random").mockReturnValue(0.75);
    try {
      let battle = createBattle(config);
      for (let index = 0; index < 4; index += 1) {
        battle = summonHero(battle, "hero-lightning");
      }
      const [first, second, third, fourth] = battle.defenders.slice(1);
      const coins = battle.coins;
      battle = moveOrMergeDefender(battle, first.id, second.slotIndex!);
      battle = moveOrMergeDefender(battle, third.id, fourth.slotIndex!);
      expect(battle.defenders.slice(1).map((hero) => [hero.actorId, hero.step]))
        .toEqual([["hero-basic-ranger", 2], ["hero-basic-ranger", 2]]);
      random.mockReturnValue(0);
      battle = moveOrMergeDefender(battle, second.id, fourth.slotIndex!);
      expect(battle.defenders.slice(1)).toEqual([expect.objectContaining({
        id: fourth.id,
        actorId: "hero-lightning",
        step: 3,
        slotIndex: fourth.slotIndex,
      })]);
      expect(battle.synthesisCount).toBe(3);
      expect(battle.coins).toBe(coins);
      expect(battle.summonCount).toBe(4);
    } finally {
      random.mockRestore();
    }
  });

  it("does not merge matching heroes of different steps or at the maximum step", () => {
    for (const steps of [[1, 2], [4, 4]]) {
      let battle = summonHero(createBattle(createConfig()), "hero-lightning");
      battle = summonHero(battle, "hero-lightning");
      battle.defenders[1].step = steps[0];
      battle.defenders[2].step = steps[1];
      battle = moveOrMergeDefender(battle, battle.defenders[1].id, battle.defenders[2].slotIndex!);
      expect(battle.synthesisCount).toBe(0);
      expect(battle.defenders.slice(1)).toHaveLength(2);
    }
  });

  it("does not merge heroes with different source ids", () => {
    let battle = summonHero(createBattle(createConfig()), "hero-basic-gunner");
    battle = summonHero(battle, "hero-basic-ranger");
    const source = battle.defenders[1];
    const target = battle.defenders[2];
    battle = moveOrMergeDefender(battle, source.id, target.slotIndex!);

    expect(battle.synthesisCount).toBe(0);
    expect(battle.defenders.filter((defender) => defender.kind === "hero"))
      .toHaveLength(2);
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

  it("faces the target on either side when beginning an attack", () => {
    for (const [slotX, facingX] of [[120, -1], [-120, 1]]) {
      const config = createConfig();
      config.towerSlots[0].position = { x: slotX, y: 0 };
      const battle = stepBattle(summonHero(createBattle(config), "hero-lightning"));
      expect(battle.defenders[1].animation).toBe("attack_1");
      expect(battle.defenders[1].facingX).toBe(facingX);
    }
  });

  it("waits for a target to enter the configured attack radius", () => {
    const config = createConfig();
    config.towerSlots[0].position = { x: 1000, y: 0 };
    config.waves[0].spawnGroups[0].monster.moveSpeed = 0;
    let battle = stepBattle(summonHero(createBattle(config), "hero-lightning"));
    expect(battle.defenders[1].animation).toBe("stand");
    battle.enemies[0].distance = 701;
    battle = stepBattle(battle);
    expect(battle.defenders[1].animation).toBe("attack_1");
  });

  it("starts the lord melee attack only when the enemy enters its radius", () => {
    const config = createConfig();
    config.lord.range = 40;
    config.waves[0].spawnGroups[0].monster.moveSpeed = 0;
    let battle = stepBattle(createBattle(config));
    // Lord is at x=60; the enemy starts at x=0, outside melee range.
    expect(battle.defenders[0].animation).toBe("stand");
    battle.enemies[0].distance = 19;
    battle = stepBattle(battle);
    expect(battle.defenders[0].animation).toBe("stand");
    battle.enemies[0].distance = 20;
    battle = stepBattle(battle);
    expect(battle.defenders[0].animation).toBe("attack_1");
    expect(battle.defenders[0].targetId).toBe(battle.enemies[0].id);
  });

  it("does not invent a hit event when timing is unresolved", () => {
    const deployed = summonHero(createBattle(createConfig(null)), "hero-lightning");
    const battle = stepTicks(deployed, 120);
    expect(battle.enemies[0].hp).toBe(100);
  });

  it("chains lightning to two distinct nearby enemies with 75% of the primary attack", () => {
    const config = createConfig();
    config.lightningChain = { sourceId: 30001, additionalTargets: 2, radius: 55, damageRatio: 0.75, arcDuration: 0.15 };
    const group = config.waves[0].spawnGroups[0];
    group.count = 4;
    group.intervalMs = 0;
    group.monster.moveSpeed = 0;
    let battle = stepTicks(createBattle(config), 4);
    battle.enemies.forEach((enemy, index) => { enemy.distance = 300 - index * 50; });
    battle = summonHero(battle, "hero-lightning");
    const before = stepTicks(battle, 6);
    expect(before.enemies.map((enemy) => enemy.hp)).toEqual([100, 100, 100, 100]);
    expect(before.lightningArcs).toEqual([]);
    const after = stepTicks(before, 2);
    expect(after.enemies.map((enemy) => enemy.hp)).toEqual([60, 70, 70, 100]);
    expect(after.defenders[1].damageDealt).toBe(100);
    expect(after.lightningArcs.map((arc) => [arc.from.x, arc.to.x]))
      .toEqual([[120, 300], [300, 250], [250, 200]]);
    expect(before.enemies.map((enemy) => enemy.hp)).toEqual([100, 100, 100, 100]);
    expect(stepTicks(after, 12).lightningArcs).toEqual([]);
    expect(stepTicks(after, 12).enemies.map((enemy) => enemy.hp)).toEqual([60, 70, 70, 100]);
    expect(stepBattle({ ...after, status: "paused" }).lightningArcs).toBe(after.lightningArcs);
  });

  it("stops the chain at a gap and does not hit an enemy twice", () => {
    const config = createConfig();
    config.lightningChain = { sourceId: 30001, additionalTargets: 2, radius: 55, damageRatio: 0.75, arcDuration: 0.15 };
    config.waves[0].spawnGroups[0].intervalMs = 0;
    config.waves[0].spawnGroups[0].monster.moveSpeed = 0;
    let battle = stepTicks(createBattle(config), 2);
    battle.enemies[0].distance = 300;
    battle.enemies[1].distance = 244;
    battle = stepTicks(summonHero(battle, "hero-lightning"), 8);
    expect(battle.enemies.map((enemy) => enemy.hp)).toEqual([60, 100]);
    expect(battle.lightningArcs).toHaveLength(1);
  });

  it("credits chained kills once and uses full attack rather than overkill-capped damage", () => {
    const config = createConfig();
    config.lightningChain = { sourceId: 30001, additionalTargets: 2, radius: 55, damageRatio: 0.75, arcDuration: 0.15 };
    config.waves[0].spawnGroups[0].intervalMs = 0;
    config.waves[0].spawnGroups[0].monster.moveSpeed = 0;
    let battle = stepTicks(createBattle(config), 2);
    battle.enemies[0].distance = 300;
    battle.enemies[0].hp = 10;
    battle.enemies[1].distance = 250;
    battle.enemies[1].hp = 25;
    battle = stepTicks(summonHero(battle, "hero-lightning"), 8);
    expect(battle.enemies.every((enemy) => enemy.animation === "dead")).toBe(true);
    expect(battle.defenders[1].damageDealt).toBe(35);
    expect(battle.coins).toBe(120);
    expect(stepTicks(battle, 20).coins).toBe(120);
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
