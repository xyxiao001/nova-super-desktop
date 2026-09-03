import type { BattleConfig } from "./frontlineCore";
import type { LevelAssetManifest } from "./levelAssetManifest";

const MANIFEST_URL = "/assets/games/frontline/levels/desert-1/manifest.json";
const RANGE_VALUE_TO_LOGICAL_PIXELS = 20;

export const loadFirstLevel = async (): Promise<{
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
  const heroes = manifest.battleProfile.waveConfig.heroes.map((hero) => {
    const actor = heroActors.get(hero.id);
    const attack = actor?.animations?.find(
      (animation) => animation.name === hero.animation,
    );
    if (!actor || !attack) {
      throw new Error(`Missing attack animation for ${hero.id}`);
    }
    return {
      id: hero.id,
      name: hero.name,
      baseAttack: hero.baseAttack,
      damageCoefficient: hero.damageCoefficient,
      cooldownMs: hero.cooldownMs,
      range: hero.rangeValue * RANGE_VALUE_TO_LOGICAL_PIXELS,
      animationDurationSeconds: attack.duration,
      hitTimeSeconds: hero.hitTimeSeconds,
    };
  });

  return {
    manifest,
    battle: {
      levelId: manifest.level.id,
      path: manifest.scene.paths[0].points.map((point) => point.logical),
      towerSlots: manifest.scene.towerPositions.map((slot) => ({
        index: slot.index,
        state: slot.state,
        priority: slot.priority,
        position: slot.logical,
      })),
      heroes,
      waves: manifest.battleProfile.waveConfig.waves,
    },
  };
};
