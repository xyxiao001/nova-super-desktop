import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  LevelAssetFile,
  LevelAssetManifest,
} from "../../src/apps/frontline/levelAssetManifest";

const assetRoot = resolve("public/assets/games/frontline");
const manifestPath = resolve(assetRoot, "levels/desert-1/manifest.json");

const readManifest = async () => JSON.parse(
  await readFile(manifestPath, "utf8"),
) as LevelAssetManifest;

const fileHash = async (path: string) => createHash("sha256")
  .update(await readFile(resolve(assetRoot, path)))
  .digest("hex");

describe("frontline first-level asset manifest", () => {
  it("pins the reference level and its directly verified bundles", async () => {
    const manifest = await readManifest();

    expect(manifest.level).toEqual({
      id: "desert-1",
      sourceId: 100101,
      chapter: 1,
      order: 1,
      name: "烈日沙漠1",
      auditStatus: "blocked-by-behavior-config",
    });
    expect(manifest.sourceVersion).toBe("412f11e3c27d645ddeafcf921f558d57");
    expect(manifest.unityVersion).toBe("2022.3.48t7");
    expect(manifest.bundles.map((bundle) => bundle.id)).toEqual([
      "level",
      "map",
      "mapSprites",
      "monsterJiachong",
      "monsterXiyi",
      "monsterZongquan",
      "fightUi",
      "fightUiTextures",
      "heroJinx",
      "heroLightning",
      "heroClown",
      "heroSummoner",
      "lordSandKing",
    ]);
    expect(manifest.bundles.every((bundle) => bundle.sha256.length === 64))
      .toBe(true);
  });

  it("preserves the source geometry in the 900 by 1600 logical projection", async () => {
    const { scene } = await readManifest();

    expect(scene.background).toMatchObject({ width: 900, height: 1600 });
    expect(scene.projection).toEqual({
      logicalWidth: 900,
      logicalHeight: 1600,
      pixelsPerWorldUnit: 100,
      logicalOrigin: { x: 450, y: 800 },
      worldYAxis: "up",
      logicalYAxis: "down",
    });
    expect(scene.paths).toHaveLength(1);
    expect(scene.paths[0].points).toHaveLength(12);
    expect(scene.paths[0].points[0].logical).toEqual({ x: 430, y: 294 });
    expect(scene.paths[0].points.at(-1)?.logical).toEqual({ x: 490, y: 1450 });
    expect(scene.towerPositions).toHaveLength(12);
    expect(scene.towerPositions.filter((tower) => tower.state === "deployable"))
      .toHaveLength(7);
    expect(scene.towerPositions.filter((tower) => tower.state === "locked"))
      .toHaveLength(5);
    expect(scene.playerSlot.logical).toEqual({ x: 340, y: 1300 });
    expect(scene.crystal.logical).toEqual({ x: 462.414, y: 1423.554 });
  });

  it("records the four lineup heroes, Sand King, and three observed enemy types", async () => {
    const { actors, battleProfile } = await readManifest();

    expect(battleProfile).toMatchObject({
      waveCount: 6,
      threeStarTimeSeconds: 220,
      lineupHeroCount: 4,
      enemyRosterCount: 3,
      boss: {
        status: "not-observed",
        challengePanelHasBossCard: false,
      },
    });
    expect(actors.heroes.map((actor) => actor.id)).toEqual([
      "hero-summoner",
      "hero-clown",
      "hero-jinx",
      "hero-lightning",
    ]);
    expect(actors.lord).toMatchObject({
      id: "lord-sand-king",
      role: "lord",
      displayName: "沙王",
    });
    expect(actors.enemies.map((actor) => actor.displayName)).toEqual([
      "沙甲虫",
      "沙漠蜥蜴",
      "野狗",
    ]);
    expect(actors.playerSlot).toMatchObject({
      binding: "runtime-player-loadout",
      fixedActor: "lord-sand-king",
    });

    for (const actor of [...actors.heroes, actors.lord, ...actors.enemies]) {
      expect(actor.binaryVersion, actor.id).toBe("4.2.33");
      expect(actor.lifecycleAudit.missing, actor.id).toEqual([]);
      expect(
        actor.animations.every((animation) => animation.events.length === 0),
        actor.id,
      ).toBe(true);
    }
  });

  it("records hashes and sizes for every extracted first-level artifact", async () => {
    const manifest = await readManifest();
    const files: LevelAssetFile[] = [
      manifest.scene.sourceConfig,
      manifest.scene.background.file,
      manifest.battleProfile.waveConfig.file,
      ...manifest.scene.mapSprites.map((sprite) => sprite.file),
      ...manifest.actors.heroes.flatMap((actor) => Object.values(actor.files)),
      ...Object.values(manifest.actors.lord.files),
      ...manifest.actors.enemies.flatMap((actor) => Object.values(actor.files)),
      manifest.audio.backgroundMusic.file,
      ...manifest.combatEventData.map((entry) => entry.file),
    ];

    for (const file of files) {
      const contents = await readFile(resolve(assetRoot, file.path));
      expect(contents.byteLength, file.path).toBe(file.bytes);
      expect(await fileHash(file.path), file.path).toBe(file.sha256);
    }
  });

  it("decodes the complete first-level wave composition from RKT and DBC", async () => {
    const { waveConfig } = (await readManifest()).battleProfile;

    expect(waveConfig.rktFormat).toEqual({
      magic: "rkt\\0",
      headerBytes: 8,
      privatePrefixBytes: 8,
      encryptedPrefixBytes: 16384,
      tailOffsetBytes: 16392,
      tailTransform: "xor-repeat",
      tailXorKeyHex: "8a7ba4d2",
    });
    expect(waveConfig.dbcFormat).toEqual({
      magic: "DBC\\n1000",
      headerBytes: 108,
      rowLayout: "fixed-width",
      dictionaryValues: "indexed",
      int64Values: "indexed",
      listValues: "variable-width-integer-sequences",
      stringLengths: "7-bit-encoded",
    });
    expect(waveConfig.sourceContainer).toEqual({
      file: "Boot_412f11e3c27d645ddeafcf921f558d57.zip",
      sha256: "e57d37860136a649a521f007c2ec1d1f28e656013dc035a082a9abfc133d1688",
      nestedEntry: "BinaryAssets/CSV.zip",
      nestedSha256: "326acbd88696cc48944568df816fd6865ff5fa1e88eada2b709589470f6ed555",
      tables: [
        {
          name: "EctypeWave.csv",
          sha256: "3fed4f2b996680f6f6afe0630080521475617e72a84ec3b37b840ebc88011266",
        },
        {
          name: "ectype_spawn_monster_info_c.csv",
          sha256: "4fc55ed7906480d0b826da2e3b679f24e5de241d362e5a2a98a47896d3ec8722",
        },
        {
          name: "Monster.csv",
          sha256: "095f17597424940ee48c1b13c632ac8eb11ff4b1f32fa68f844f23ff49ef8499",
        },
        {
          name: "MonsterLevelProp_C.csv",
          sha256: "bd61937b6fa59725fee366e1dbace5bc145f41873e7ff2d19fb15eabd85726d8",
        },
        {
          name: "Skill.csv",
          sha256: "aef551e9e1051a13b3e2606388d18b871023a5fed63cc7e50f8e7cbe89d1f128",
        },
        {
          name: "ectype_misc_info_c.csv",
          sha256: "ca398ba652e560c5d63f4b9d860bee24b4e63896ca7a8d0c0fcbd1f2f7147bf9",
        },
        {
          name: "hero_c.csv",
          sha256: "e273f3f8e2c2a0a5ec2e6fb933c9b317ee1b1f9b2cc5ce038a2d31887d7b04d2",
        },
        {
          name: "HeroPropBase.csv",
          sha256: "dedb6959e3a829048c10759eae73e802aacd50b95cfcfb97f8995164b1a32f45",
        },
        {
          name: "PetSkill.csv",
          sha256: "3a5058777ebe48ef8f2df8f59124023df06f7a7388afc23efa12261c09f7859a",
        },
        {
          name: "Freeze.csv",
          sha256: "1a782edb82f8d0f40513c3a80761dfac7eaa4d53a392398494fecac0908ff16e",
        },
      ],
    });
    expect(waveConfig.heroes.map((hero) => hero.rangeValue))
      .toEqual([[2000], [800], [550], [550]]);
    expect(waveConfig.economy).toEqual({
      initialCoins: 100,
      baseHp: 20,
      summonCosts: [
        10, 20, 30, 45, 60, 80, 90, 110, 130, 150, 160,
        175, 190, 200, 215, 235, 260, 290, 320, 350, 380,
        420, 455, 485, 515, 545, 575, 605, 620, 630, 640,
        650, 660,
      ],
      strengthenCosts: [100, 200, 300, 400, 600, 800, 1000, 1200, 1500, 1500, 1500],
      strengthenUnlockSummons: 5,
    });
    expect(waveConfig.waves.map((wave) => ({
      wave: wave.wave,
      waitTimeMs: wave.waitTimeMs,
      leftMonsterNextWave: wave.leftMonsterNextWave,
      totalMonsterCount: wave.totalMonsterCount,
    }))).toEqual([
      { wave: 1, waitTimeMs: 0, leftMonsterNextWave: 4, totalMonsterCount: 8 },
      { wave: 2, waitTimeMs: 20000, leftMonsterNextWave: 5, totalMonsterCount: 12 },
      { wave: 3, waitTimeMs: 25000, leftMonsterNextWave: 5, totalMonsterCount: 12 },
      { wave: 4, waitTimeMs: 30000, leftMonsterNextWave: 5, totalMonsterCount: 20 },
      { wave: 5, waitTimeMs: 40000, leftMonsterNextWave: 6, totalMonsterCount: 21 },
      { wave: 6, waitTimeMs: 40000, leftMonsterNextWave: 6, totalMonsterCount: 56 },
    ]);
    expect([
      ...new Set(
        waveConfig.waves.flatMap((wave) => wave.spawnGroups)
          .map((group) => `${group.monster.id}:${group.monster.name}`),
      ),
    ]).toEqual([
      "1001:沙漠蜥蜴",
      "1003:沙甲虫",
      "1002:野狗",
      "3001:沙漠蜥蜴精英",
    ]);
    expect(waveConfig.waves.map((wave) => wave.monsterHpRatio))
      .toEqual([1, 1.2, 1.8, 2.34, 2.34, 2.38]);

    const monsterBaseHp = Object.fromEntries(
      waveConfig.waves
        .flatMap((wave) => wave.spawnGroups)
        .map((group) => [group.monster.id, group.monster.baseHp]),
    );
    expect(monsterBaseHp).toEqual({
      1001: 299,
      1002: 224,
      1003: 598,
      3001: 2392,
    });
    for (const wave of waveConfig.waves) {
      for (const group of wave.spawnGroups) {
        expect(group.monster.hp).toBeCloseTo(
          group.monster.baseHp * wave.monsterHpRatio,
        );
      }
    }
  });

  it("decodes combat event frames for the current lineup and Sand King", async () => {
    const { combatEventData } = await readManifest();
    const jinx = combatEventData.find(
      (entry) => entry.owner === "hero-jinx",
    );
    const lightning = combatEventData.find(
      (entry) => entry.owner === "hero-lightning",
    );
    const lord = combatEventData.find(
      (entry) => entry.owner === "lord-sand-king",
    );

    expect(jinx).toMatchObject({
      formatVersion: 2,
      nominalFrameRate: 30,
    });
    expect(jinx?.records).toHaveLength(15);
    expect(lightning?.records).toHaveLength(21);
    expect(lord?.records).toHaveLength(21);

    const jinxAttack = jinx?.records.find(
      (record) => record.variantId === 100
        && record.animation === "attack_1",
    );
    expect(jinxAttack).toMatchObject({
      triggerFrame: 1,
      triggerTimeSeconds: 0.033333,
      eventSourceType: 1,
      eventType: 27,
      soundId: 0,
      parameters: {
        EffectPrefabArray: "Assets/IGSoft_Resources/Projects/Prefabs/Hero/jinkesi/Emiter_eff_heros_jinkesi_attack_zd_1.prefab",
      },
    });

    const lightningAttack = lightning?.records.find(
      (record) => record.variantId === 100
        && record.animation === "attack_1",
    );
    expect(lightningAttack).toMatchObject({
      triggerFrame: 7,
      triggerTimeSeconds: 0.233333,
      eventSourceType: 1,
      eventType: 27,
      parameters: {
        initSpeed: "10",
        EffectPrefabArray: "Assets/IGSoft_Resources/Projects/Prefabs/Hero/shandianqiu/Emiter_hero_shandianqiu_zidan1.prefab|Assets/IGSoft_Resources/Projects/Audio/heroAudio/Audio_shandianqiu_attack.prefab",
      },
    });

    const lordHit = lord?.records.find(
      (record) => record.variantId === 104
        && record.animation === "attack_1",
    );
    expect(lordHit).toMatchObject({
      triggerFrame: 2,
      triggerTimeSeconds: 0.066667,
      eventSourceType: 1,
      eventType: 2,
      parameters: {
        EffectPrefabArray: "Assets/IGSoft_Resources/Projects/Prefabs/player/shawang/eff_player_shawang_sj.prefab|Assets/IGSoft_Resources/Projects/Audio/heroAudio/Audio_shawang_attackSJ.prefab",
      },
    });
  });

  it("keeps unresolved behavior evidence explicit and blocking", async () => {
    const manifest = await readManifest();
    const blocking = manifest.unresolved
      .filter((item) => item.blocking)
      .map((item) => item.id);

    expect(blocking).toEqual([
      "summoner-and-lord-damage-attribution",
      "hero-projectile-and-hit-effects",
      "hurt-feedback",
    ]);
  });
});
