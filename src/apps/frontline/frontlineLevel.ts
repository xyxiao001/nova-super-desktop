import type { BattleConfig } from "./frontlineCore";
import {
  FRONTLINE_HERO_BY_ID,
  type FrontlineHeroId,
  type FrontlineHeroRoster,
} from "./frontlineRoster";
import type { LevelAssetManifest } from "./levelAssetManifest";

const MANIFEST_URL = "/assets/games/frontline/levels/desert-1/manifest.json";
const RANGE_VALUE_TO_LOGICAL_PIXELS = 20;

export const loadFirstLevel = async (
  lineup: FrontlineHeroId[],
  roster: FrontlineHeroRoster,
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
    return {
      id: definition.actorId,
      name: hero.name,
      baseAttack: roster[id].attack,
      damageCoefficient: hero.damageCoefficient,
      cooldownMs: hero.cooldownMs,
      range: hero.rangeValue[0] * RANGE_VALUE_TO_LOGICAL_PIXELS,
      animationDurationSeconds: attack.duration,
      hitTimeSeconds: hero.hitTimeSeconds,
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
        name: lordProfile.name,
        baseAttack: lordProfile.referencePower,
        damageCoefficient: 0,
        cooldownMs: lordProfile.cooldownMs,
        range: lordProfile.rangeValue * RANGE_VALUE_TO_LOGICAL_PIXELS,
        animationDurationSeconds: lordAttack.duration,
        hitTimeSeconds: lordProfile.hitTimeSeconds,
      },
      heroes,
      waves: manifest.battleProfile.waveConfig.waves,
      economy: manifest.battleProfile.waveConfig.economy,
    },
  };
};
