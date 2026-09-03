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
  role: "fixed-first-level-hero" | "enemy";
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
    fixedHeroCount: number;
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
        stringLengths: "7-bit-encoded";
      };
      heroes: Array<{
        id: string;
        sourceId: number;
        name: string;
        normalSkillId: number;
        baseAttack: number;
        damageCoefficient: number;
        cooldownMs: number;
        rangeValue: number;
        animation: string;
        hitTimeSeconds: number | null;
      }>;
      waves: Array<{
        wave: number;
        totalWaves: number;
        waitTimeMs: number;
        leftMonsterNextWave: number;
        violentLeftMonsterNextWave: number;
        notWaitWaveAllSpawn: boolean;
        bossEffect: number;
        totalMonsterCount: number;
        spawnGroups: Array<{
          id: number;
          spawnPointId: number;
          subKey: number;
          waitTimeMs: number;
          intervalMs: number;
          durationMs: number;
          count: number;
          pathOffsetType: number;
          monsterLevel: number;
          monster: {
            id: number;
            name: string;
            resourceId: number;
            moveSpeed: number;
            hpScale: number;
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
    enemies: LevelSpineActor[];
    playerSlot: {
      binding: "runtime-player-loadout";
      fixedActor: null;
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
  unresolved: Array<{
    id: string;
    blocking: boolean;
    reason: string;
    requiredEvidence: string;
  }>;
};
