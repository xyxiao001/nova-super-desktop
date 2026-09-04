export type LevelAssetEvidenceType =
  | "bundle-object"
  | "live-observation"
  | "rkt-config";

export type LevelAssetFile = {
  path: string;
  bytes: number;
  sha256: string;
};

export type LevelPoint = {
  world: { x: number; y: number };
  logical: { x: number; y: number };
};

export type LevelSpineActor = {
  id: string;
  role: "lineup-hero" | "lord" | "enemy" | "summon";
  sourceName: string;
  displayName: string | null;
  sourceBundle: string;
  binaryVersion: string;
  scale: number;
  skins: string[];
  requiredAnimations: string[];
  animations: Array<{
    name: string;
    duration: number;
    events: Array<{
      time: number;
      name: string;
      intValue: number;
      floatValue: number;
      stringValue: string;
    }>;
  }>;
  lifecycleAudit: {
    required: string[];
    missing: string[];
  };
  files: Record<"atlas" | "skeleton" | "texture", LevelAssetFile>;
};

export type LevelAssetManifest = {
  schemaVersion: 1;
  scope: "frontline-level-asset-manifest";
  level: {
    id: string;
    sourceId: number;
    chapter: number;
    order: number;
    name: string;
    auditStatus: "blocked-by-behavior-config" | "complete";
  };
  sourceVersion: string;
  unityVersion: string;
  evidence: Array<{
    id: string;
    type: LevelAssetEvidenceType;
    source: string;
    facts: string[];
  }>;
  bundles: Array<{
    id: string;
    file: string;
    bytes: number;
    sha256: string;
    evidence: string;
    objectTypes: Record<string, number>;
  }>;
  scene: {
    sourceConfig: LevelAssetFile;
    projection: {
      logicalWidth: number;
      logicalHeight: number;
      pixelsPerWorldUnit: number;
      logicalOrigin: { x: number; y: number };
      worldYAxis: "up";
      logicalYAxis: "down";
    };
    paths: Array<{
      index: number;
      points: LevelPoint[];
    }>;
    towerPositions: Array<
      LevelPoint & {
        index: number;
        towerType: number;
        state: "locked" | "deployable";
        priority: number;
      }
    >;
    playerSlot: LevelPoint & {
      binding: "runtime-player-loadout";
    };
    crystal: LevelPoint;
    background: {
      sourceObject: string;
      width: number;
      height: number;
      file: LevelAssetFile;
    };
    mapSprites: Array<{
      name: string;
      purpose: string;
      exportedSize: { width: number; height: number };
      file: LevelAssetFile;
    }>;
  };
  battleProfile: {
    waveCount: number;
    threeStarTimeSeconds: number;
    lineupHeroCount: number;
    enemyRosterCount: number;
    waveConfig: {
      sourceVersion: string;
      sourceContainer: {
        file: string;
        sha256: string;
        nestedEntry: string;
        nestedSha256: string;
        tables: Array<{
          name: string;
          sha256: string;
        }>;
      };
      rktFormat: {
        magic: "rkt\\0";
        headerBytes: number;
        privatePrefixBytes: number;
        encryptedPrefixBytes: number;
        tailOffsetBytes: number;
        tailTransform: "xor-repeat";
        tailXorKeyHex: string;
      };
      dbcFormat: {
        magic: "DBC\\n1000";
        headerBytes: number;
        rowLayout: "fixed-width";
        dictionaryValues: "indexed";
        int64Values: "indexed";
        listValues: "typed-variable-width-sequences";
        stringLengths: "7-bit-encoded";
      };
      economy: {
        initialCoins: number;
        baseHp: number;
        summonCosts: number[];
        strengthenCosts: number[];
        strengthenUnlockSummons: number;
      };
      lord: {
        id: string;
        sourceId: number;
        name: string;
        referencePower: number;
        cooldownMs: number;
        rangeValue: number;
        animation: string;
        hitTimeSeconds: number | null;
      };
      heroes: Array<{
        id: string;
        sourceId: number;
        name: string;
        normalSkillId: number;
        baseAttack: number;
        damageCoefficient: number;
        cooldownMs: number;
        rangeValue: [number, ...number[]];
        animation: string;
        hitTimeSeconds: number | null;
      }>;
      summons: Array<{
        ownerSourceId: number;
        skillId: number;
        skillNeedsTarget: boolean;
        selfChanceBuff: number[];
        buffId: number;
        effectId: number;
        effectParameters: number[];
        soldierId: number;
        resourceId: number;
        maxCount: number;
        moveSpeed: number;
        modelRadius: number;
        attackDistance: number;
        seekDistance: number;
        baseAttack: number;
        attackInheritance: "caller-entity-attack";
        stepOneCallAttackRatio: number;
        normalSkillId: number;
        cooldownMs: number;
        damageCoefficient: number;
        effectRange: [number, ...number[]];
        maxTargets: number;
        lifeTimeSeconds: number;
        ownerRemovalDelayMs: number;
        bornBuffs: number[];
        spawnPointRule: "nearest-origin-road-point-within-owner-range";
      }>;
      waves: Array<{
        wave: number;
        totalWaves: number;
        waitTimeMs: number;
        leftMonsterNextWave: number;
        violentLeftMonsterNextWave: number;
        notWaitWaveAllSpawn: boolean;
        bossEffect: number;
        monsterPropRatios: number[];
        monsterHpRatio: number;
        totalMonsterCount: number;
        spawnGroups: Array<{
          id: number;
          spawnPointId: number;
          subKey: number;
          waitTimeMs: number;
          intervalMs: number;
          durationMs: number;
          count: number;
          coin: number;
          experience: number;
          pathOffsetType: number;
          monsterLevel: number;
          monster: {
            id: number;
            name: string;
            resourceId: number;
            modelRadius: number;
            moveSpeed: number;
            hpSegments: number;
            baseHp: number;
            hpRatio: number;
            hp: number;
            crystalDamage: number;
          };
        }>;
      }>;
      file: LevelAssetFile;
    };
    boss: {
      status: "not-observed" | "present" | "absent";
      challengePanelHasBossCard: boolean;
    };
    evidence: string[];
  };
  actors: {
    heroes: LevelSpineActor[];
    lord: LevelSpineActor;
    enemies: LevelSpineActor[];
    summons: LevelSpineActor[];
    playerSlot: {
      binding: "runtime-player-loadout";
      fixedActor: string;
      evidence: string[];
    };
  };
  audio: {
    backgroundMusic: {
      sourceObject: string;
      durationSeconds: number;
      frequency: number;
      channels: number;
      file: LevelAssetFile;
    };
  };
  combatEventData: Array<{
    owner: string;
    sourceObject: string;
    assetReferences: string[];
    formatVersion: number;
    nominalFrameRate: number;
    records: Array<{
      variantId: number;
      animation: string;
      triggerFrame: number;
      triggerTimeSeconds: number;
      eventSourceType: number;
      eventType: number;
      soundId: number;
      parameters: Record<string, string>;
    }>;
    file: LevelAssetFile;
  }>;
  attackEvidence: {
    distanceRule: {
      source: string;
      targetingDistanceUnits: "thousandths-of-world-unit";
      effectiveCenterDistance: "targeting-distance-plus-target-model-radius";
      includesCasterRadius: false;
    };
    units: Array<{
      owner: string;
      kind: "projectile" | "projectile-then-area-effect" | "summon-melee-unit" | "melee";
      targetingDistance: number;
      sourceBundles: string[];
      emitter?: {
        name: string;
        trackerPath: string;
        waveCount: number;
        bulletsPerWave: number;
        intervalMs: number;
      };
      projectile?: {
        name: string;
        tracker: string;
        prefabInitSpeed: number;
        prefabMaxFlyDistance: number;
        prefabDurationMs: number;
        prefabLockTarget: boolean;
        eventInitSpeed: number | null;
        eventMaxFlyDistance: number | null;
        eventMaxFlyTimeMs: number | null;
        eventLockTarget: boolean | null;
        collisionMaxCount: number;
        hitEffectPath: string;
      };
      summon?: {
        ownerSourceId: number;
        skillId: number;
        skillNeedsTarget: boolean;
        selfChanceBuff: number[];
        buffId: number;
        effectId: number;
        effectParameters: number[];
        soldierId: number;
        resourceId: number;
        moveSpeed: number;
        attackDistance: number;
        normalSkillId: number;
        attackTriggerSeconds: number;
        hitTriggerSeconds: number;
        maxCount: number;
        modelRadius: number;
        seekDistance: number;
        cooldownMs: number;
        damageCoefficient: number;
        effectRange: [number, ...number[]];
        maxTargets: number;
        baseAttack: number;
        attackInheritance: "caller-entity-attack";
        stepOneCallAttackRatio: number;
        lifeTimeSeconds: number;
        ownerRemovalDelayMs: number;
        bornBuffs: number[];
        spawnPointRule: "nearest-origin-road-point-within-owner-range";
      };
      melee?: {
        hitTriggerSeconds: number[];
        damageCoefficientPerHit: number;
        effectRange: number;
        hitEffectPath: string;
      };
    }>;
  };
  unresolved: Array<{
    id: string;
    blocking: boolean;
    reason: string;
    requiredEvidence: string;
  }>;
};
