import type { BattleConfig } from "./frontlineCore";
import {
  FRONTLINE_HERO_BY_ID,
  type FrontlineHeroId,
  type FrontlineHeroRoster,
} from "./frontlineRoster";
import type { LevelAssetManifest } from "./levelAssetManifest";

const MANIFEST_URL = "/assets/games/frontline/levels/desert-1/manifest.json";
export const FIRST_LEVEL_ATTACK_TEST_TUNING = {
  heroAttackScale: 0.05,
} as const;

export type FirstLevelTestTuning = {
  heroAttackScale: number;
};

// hero_Different_c.nProp1 (attribute 5), in thousandths of a world unit.
// Skill.RangeValue describes the skill's effect area, not targeting distance.
const HERO_ATTACK_DISTANCE: Record<FrontlineHeroId, number> = {
  summoner: 2100,
  clown: 3200,
  jinx: 3400,
  lightning: 2800,
};

const CONFIRMED_PROJECTILE_HERO_IDS = new Set([30001, 30002, 30005]);

const TUTORIAL_HEROES = [
  {
    id: "hero-basic-ranger",
    sourceId: 10002,
    name: "游侠",
    baseAttack: 40,
    damageCoefficient: 40,
    cooldownMs: 800,
    range: 550,
    animationDurationSeconds: 0.567,
    hitTimeSeconds: 0.567,
  },
  {
    id: "hero-basic-gunner",
    sourceId: 10004,
    name: "矮人炮手",
    baseAttack: 40,
    damageCoefficient: 53,
    cooldownMs: 2400,
    range: 750,
    animationDurationSeconds: 0.657,
    hitTimeSeconds: 0.657,
  },
] satisfies BattleConfig["heroes"];

export const loadFirstLevel = async (
  lineup: FrontlineHeroId[],
  roster: FrontlineHeroRoster,
  testTuning?: FirstLevelTestTuning,
): Promise<{
  battle: BattleConfig;
  manifest: LevelAssetManifest;
}> => {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Failed to load first-level manifest: ${response.status}`);
  }
  const manifest = await response.json() as LevelAssetManifest;
  if (
    manifest.level.id !== "desert-1"
    || manifest.level.sourceId !== 100101
    || manifest.battleProfile.waveConfig.waves.length !== 6
  ) {
    throw new Error("First-level manifest contract mismatch");
  }

  const heroActors = new Map(
    manifest.actors.heroes.map((actor) => [actor.id, actor]),
  );
  const summonActors = new Map(
    manifest.actors.summons.map((actor) => [actor.id, actor]),
  );
  const heroProfiles = new Map(
    manifest.battleProfile.waveConfig.heroes.map((hero) => [hero.sourceId, hero]),
  );
  const heroes = lineup.map((id) => {
    const definition = FRONTLINE_HERO_BY_ID.get(id);
    const hero = definition
      ? heroProfiles.get(definition.sourceId)
      : undefined;
    const actor = definition
      ? heroActors.get(definition.actorId)
      : undefined;
    const attack = actor?.animations?.find(
      (animation) => animation.name === hero?.animation,
    );
    if (!definition || !hero || !actor || !attack) {
      throw new Error(`Missing battle profile for ${id}`);
    }
    const attackEvidence = manifest.attackEvidence.units.find(
      (unit) => unit.owner === definition.actorId,
    );
    const summonEvidence = attackEvidence?.summon;
    return {
      id: definition.actorId,
      sourceId: definition.sourceId,
      name: hero.name,
      // Test tuning is applied only to the ephemeral battle config. The roster
      // and its persisted source values remain unchanged.
      baseAttack: roster[id].attack * (testTuning?.heroAttackScale ?? 1),
      damageCoefficient: hero.damageCoefficient,
      cooldownMs: hero.cooldownMs,
      range: HERO_ATTACK_DISTANCE[id] / 1000 * manifest.scene.projection.pixelsPerWorldUnit,
      animationDurationSeconds: attack.duration,
      // The fixed event is a release event, not an impact event. Until the
      // native Tracker movement scale is recovered, Core owns an unresolved
      // in-flight projectile and intentionally does not apply damage.
      hitTimeSeconds: CONFIRMED_PROJECTILE_HERO_IDS.has(definition.sourceId)
        ? null
        : hero.hitTimeSeconds,
      projectile: CONFIRMED_PROJECTILE_HERO_IDS.has(definition.sourceId)
        ? (() => {
          const evidence = attackEvidence?.projectile;
          const emitter = attackEvidence?.emitter;
          if (!evidence || !emitter || hero.hitTimeSeconds === null) {
            throw new Error(`Missing confirmed projectile evidence for ${definition.actorId}`);
          }
          return {
            tracker: evidence.tracker,
            releaseTimeSeconds: hero.hitTimeSeconds,
            projectileCount: emitter.waveCount * emitter.bulletsPerWave,
            releaseIntervalSeconds: emitter.intervalMs / 1000,
            sourceInitSpeed: evidence.eventInitSpeed ?? evidence.prefabInitSpeed,
            maxFlyDistance: evidence.eventMaxFlyDistance
              ?? evidence.prefabMaxFlyDistance,
            maxLifetimeSeconds: (evidence.eventMaxFlyTimeMs
              ?? evidence.prefabDurationMs) / 1000,
            lockTarget: evidence.eventLockTarget ?? evidence.prefabLockTarget,
            movementScale: null,
          };
        })()
        : undefined,
      summon: definition.sourceId === 30004
        ? (() => {
          if (!summonEvidence) {
            throw new Error("Missing confirmed summon evidence for hero-summoner");
          }
          const summonActor = summonActors.get("summon-little-ghost");
          const born = summonActor?.animations.find(
            (animation) => animation.name === "born",
          );
          if (!born) {
            throw new Error("Missing born animation for summon-little-ghost");
          }
          return {
            actorId: "summon-little-ghost",
            soldierId: summonEvidence.soldierId,
            maxCount: summonEvidence.maxCount,
            // Skill.SelfChanceBuff applies Buff 21001 with zero delay when the
            // skill starts; the frame-zero animation event is audio only.
            releaseTimeSeconds: 0,
            // LiteSoldier enables collision and starts SoldierIdle only from
            // OnBornComplete, after this exact Spine animation duration.
            bornDurationSeconds: born.duration,
            skillNeedsTarget: summonEvidence.skillNeedsTarget,
            spawnRadius: HERO_ATTACK_DISTANCE[id] / 1000
              * manifest.scene.projection.pixelsPerWorldUnit,
            modelRadius: summonEvidence.modelRadius
              * manifest.scene.projection.pixelsPerWorldUnit,
            moveSpeed: summonEvidence.moveSpeed / 1000
              * manifest.scene.projection.pixelsPerWorldUnit,
            range: summonEvidence.attackDistance / 1000
              * manifest.scene.projection.pixelsPerWorldUnit,
            seekDistance: summonEvidence.seekDistance / 1000
              * manifest.scene.projection.pixelsPerWorldUnit,
            cooldownMs: summonEvidence.cooldownMs,
            damageCoefficient: summonEvidence.damageCoefficient,
            maxTargets: summonEvidence.maxTargets,
            attackInheritance: summonEvidence.attackInheritance,
          };
        })()
        : undefined,
    };
  });
  const lordProfile = manifest.battleProfile.waveConfig.lord;
  const lordAttack = manifest.actors.lord.animations.find(
    (animation) => animation.name === lordProfile.animation,
  );
  if (!lordAttack) {
    throw new Error("Missing attack animation for lord-sand-king");
  }

  return {
    manifest,
    battle: {
      levelId: manifest.level.id,
      path: manifest.scene.paths[0].points.map((point) => point.logical),
      playerSlot: manifest.scene.playerSlot.logical,
      towerSlots: manifest.scene.towerPositions.map((slot) => ({
        index: slot.index,
        state: slot.state,
        priority: slot.priority,
        position: slot.logical,
      })),
      lord: {
        id: lordProfile.id,
        sourceId: lordProfile.sourceId,
        name: lordProfile.name,
        baseAttack: lordProfile.referencePower,
        damageCoefficient: 80,
        cooldownMs: lordProfile.cooldownMs,
        // lord_base_c.nAttackDistance = 5;400. Attribute 5 uses millimetres.
        range: 400 / 1000 * manifest.scene.projection.pixelsPerWorldUnit,
        animationDurationSeconds: lordAttack.duration,
        hitTimeSeconds: 0.066667,
        additionalHitTimeSeconds: [0.6],
      },
      lordMoveSpeed: 200,
      heroes: [...heroes, ...TUTORIAL_HEROES],
      synthesisHeroIds: heroes.map((hero) => hero.id),
      maxSynthesisStep: 4,
      lightningChain: {
        sourceId: 30001,
        additionalTargets: 2,
        radius: 550 / 1000 * manifest.scene.projection.pixelsPerWorldUnit,
        damageRatio: 0.75,
        arcDuration: 0.15,
      },
      tutorial: {
        fixedSummons: [],
        fixedMerges: [],
      },
      waves: manifest.battleProfile.waveConfig.waves.map((wave) => ({
        ...wave,
        spawnGroups: wave.spawnGroups.map((group) => ({
          ...group,
          monster: {
            ...group.monster,
            modelRadius: group.monster.modelRadius
              * manifest.scene.projection.pixelsPerWorldUnit,
          },
        })),
      })),
      economy: manifest.battleProfile.waveConfig.economy,
    },
  };
};
