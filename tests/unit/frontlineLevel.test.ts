import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  FIRST_LEVEL_ATTACK_TEST_TUNING,
  loadFirstLevel,
} from "../../src/apps/frontline/frontlineLevel";
import type { FrontlineHeroId, FrontlineHeroRoster } from "../../src/apps/frontline/frontlineRoster";

describe("first-level targeting distance", () => {
  it("uses hero attack distance instead of the skill effect radius", async () => {
    const manifest = JSON.parse(await readFile(
      "public/assets/games/frontline/levels/desert-1/manifest.json", "utf8",
    ));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(manifest)));
    const lineup: FrontlineHeroId[] = ["summoner", "clown", "jinx", "lightning"];
    const roster = Object.fromEntries(lineup.map((id) => [id, {
      level: 1, attack: 100, pieces: 0, material: 0,
    }])) as FrontlineHeroRoster;
    try {
      const { battle } = await loadFirstLevel(lineup, roster);
      expect(battle.heroes.slice(0, 4).map((hero) => hero.range)).toEqual([210, 320, 340, 280]);
      expect(battle.lord.range).toBe(40);
      expect(battle.lord).toMatchObject({
        damageCoefficient: 80,
        hitTimeSeconds: 0.066667,
        additionalHitTimeSeconds: [0.6],
      });
      expect(battle.heroes.find((hero) => hero.sourceId === 30004)).toMatchObject({
        hitTimeSeconds: null,
        summon: {
          actorId: "summon-little-ghost",
          soldierId: 52001,
          maxCount: 1,
          releaseTimeSeconds: 0,
          bornDurationSeconds: 0.40000003576278687,
          skillNeedsTarget: false,
          spawnRadius: 210,
          modelRadius: 40,
          moveSpeed: 150,
          range: 40,
          seekDistance: 100,
          cooldownMs: 2000,
          damageCoefficient: 550,
          maxTargets: 99,
          attackInheritance: "caller-entity-attack",
        },
      });
      expect(battle.heroes.find((hero) => hero.sourceId === 30001)).toMatchObject({
        hitTimeSeconds: null,
        projectile: {
          tracker: "SDThunderChainTracker",
          releaseTimeSeconds: 0.233333,
          projectileCount: 1,
          releaseIntervalSeconds: 0.2,
          sourceInitSpeed: 10,
          maxFlyDistance: 90,
          maxLifetimeSeconds: 3,
          lockTarget: false,
          movementScale: null,
        },
      });
      expect(battle.heroes.find((hero) => hero.sourceId === 30002)).toMatchObject({
        hitTimeSeconds: null,
        projectile: {
          tracker: "SDEffectBullet2DTracker",
          releaseTimeSeconds: 0.033333,
          projectileCount: 2,
          releaseIntervalSeconds: 0.08,
          sourceInitSpeed: 8.5,
          maxFlyDistance: 20,
          maxLifetimeSeconds: 10,
          lockTarget: false,
          movementScale: null,
        },
      });
      expect(battle.heroes.find((hero) => hero.sourceId === 30005)).toMatchObject({
        hitTimeSeconds: null,
        damageCoefficient: 0,
        projectile: {
          tracker: "SDEffectBullet2DTracker",
          releaseTimeSeconds: 0.166667,
          projectileCount: 1,
          releaseIntervalSeconds: 0.13,
          sourceInitSpeed: 10,
          maxFlyDistance: 90,
          maxLifetimeSeconds: 3,
          lockTarget: false,
          movementScale: null,
        },
      });
      expect(battle.heroes.slice(0, 4).map((hero) => hero.animationDurationSeconds))
        .toEqual(manifest.actors.heroes.map((actor: { animations: { name: string; duration: number }[] }) => (
          actor.animations.find((animation) => animation.name === "attack_1")!.duration
        )));
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("keeps source roster attack intact while applying explicit battle test tuning", async () => {
    const manifest = JSON.parse(await readFile(
      "public/assets/games/frontline/levels/desert-1/manifest.json", "utf8",
    ));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(manifest)),
    );
    const lineup: FrontlineHeroId[] = ["summoner", "clown", "jinx", "lightning"];
    const roster = Object.fromEntries(lineup.map((id) => [id, {
      level: 1, attack: 2000, pieces: 0, material: 0,
    }])) as FrontlineHeroRoster;

    try {
      const { battle } = await loadFirstLevel(
        lineup,
        roster,
        FIRST_LEVEL_ATTACK_TEST_TUNING,
      );
      expect(battle.heroes.slice(0, 4).map((hero) => hero.baseAttack))
        .toEqual([100, 100, 100, 100]);
      expect(roster.lightning.attack).toBe(2000);
      expect(battle.lord.baseAttack).toBe(1178);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
