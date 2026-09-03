export const FIXED_STEP_SECONDS = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
const SOURCE_SPEED_TO_LOGICAL_PIXELS = 0.1;

export type Point = { x: number; y: number };
export type BattleStatus = "active" | "paused" | "won" | "lost";
export type ActorAnimation = "stand" | "run" | "attack_1" | "dead";

export type HeroConfig = {
  id: string;
  name: string;
  baseAttack: number;
  damageCoefficient: number;
  cooldownMs: number;
  range: number;
  animationDurationSeconds: number;
  hitTimeSeconds: number | null;
};

export type SpawnGroupConfig = {
  id: number;
  waitTimeMs: number;
  intervalMs: number;
  count: number;
  pathOffsetType: number;
  monster: {
    id: number;
    name: string;
    moveSpeed: number;
    hpScale: number;
    crystalDamage: number;
  };
};

export type WaveConfig = {
  wave: number;
  waitTimeMs: number;
  leftMonsterNextWave: number;
  totalMonsterCount: number;
  spawnGroups: SpawnGroupConfig[];
};

export type BattleConfig = {
  levelId: string;
  path: Point[];
  towerSlots: Array<{
    index: number;
    state: "locked" | "deployable";
    priority: number;
    position: Point;
  }>;
  heroes: HeroConfig[];
  waves: WaveConfig[];
};

export type Enemy = {
  id: number;
  monsterId: number;
  name: string;
  actorId: string;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  crystalDamage: number;
  distance: number;
  pathOffsetType: number;
  animation: ActorAnimation;
  deathRemaining: number;
};

export type Defender = {
  id: number;
  slotIndex: number;
  actorId: string;
  name: string;
  attack: number;
  range: number;
  cooldownSeconds: number;
  cooldownRemaining: number;
  animationDurationSeconds: number;
  hitTimeSeconds: number | null;
  attackElapsed: number;
  attackApplied: boolean;
  targetId: number | null;
  animation: ActorAnimation;
};

export type BattleState = {
  config: BattleConfig;
  tick: number;
  elapsed: number;
  waveIndex: number;
  waveElapsed: number;
  groupSpawned: Record<number, number>;
  nextEnemyId: number;
  enemies: Enemy[];
  defenders: Defender[];
  baseHp: number;
  status: BattleStatus;
};

const MONSTER_ACTORS: Record<number, string> = {
  1001: "monster-01-xiyi",
  1002: "monster-01-zongquan",
  1003: "monster-01-jiachong",
  3001: "monster-01-xiyi",
};

const pathLength = (points: Point[]) => points.slice(1).reduce(
  (total, point, index) => total + Math.hypot(
    point.x - points[index].x,
    point.y - points[index].y,
  ),
  0,
);

export const pathPosition = (points: Point[], distance: number): Point => {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segment = Math.hypot(to.x - from.x, to.y - from.y);
    if (remaining <= segment) {
      const ratio = segment === 0 ? 0 : remaining / segment;
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      };
    }
    remaining -= segment;
  }
  return points.at(-1) ?? { x: 0, y: 0 };
};

export const createBattle = (config: BattleConfig): BattleState => {
  const slots = config.towerSlots
    .filter((slot) => slot.state === "deployable")
    .sort((left, right) => left.priority - right.priority)
    .slice(0, config.heroes.length);
  if (slots.length < config.heroes.length) {
    throw new Error("First-level manifest does not have enough deployable slots");
  }

  return {
    config,
    tick: 0,
    elapsed: 0,
    waveIndex: 0,
    waveElapsed: 0,
    groupSpawned: {},
    nextEnemyId: 1,
    enemies: [],
    defenders: config.heroes.map((hero, index) => ({
      id: index + 1,
      slotIndex: slots[index].index,
      actorId: hero.id,
      name: hero.name,
      attack: hero.baseAttack * hero.damageCoefficient / 100,
      range: hero.range,
      cooldownSeconds: hero.cooldownMs / 1000,
      cooldownRemaining: index * 0.12,
      animationDurationSeconds: hero.animationDurationSeconds,
      hitTimeSeconds: hero.hitTimeSeconds,
      attackElapsed: 0,
      attackApplied: false,
      targetId: null,
      animation: "stand",
    })),
    baseHp: 10,
    status: "active",
  };
};

const spawnEnemy = (
  state: BattleState,
  group: SpawnGroupConfig,
) => {
  const actorId = MONSTER_ACTORS[group.monster.id];
  if (!actorId) {
    throw new Error(`No Spine actor mapped for monster ${group.monster.id}`);
  }
  state.enemies.push({
    id: state.nextEnemyId,
    monsterId: group.monster.id,
    name: group.monster.name,
    actorId,
    hp: group.monster.hpScale * 100,
    maxHp: group.monster.hpScale * 100,
    moveSpeed: group.monster.moveSpeed,
    crystalDamage: group.monster.crystalDamage,
    distance: 0,
    pathOffsetType: group.pathOffsetType,
    animation: "run",
    deathRemaining: 0,
  });
  state.nextEnemyId += 1;
};

const spawnWaveGroups = (state: BattleState) => {
  const wave = state.config.waves[state.waveIndex];
  for (const group of wave.spawnGroups) {
    const spawned = state.groupSpawned[group.id] ?? 0;
    if (spawned >= group.count) continue;
    const interval = group.intervalMs / 1000;
    const nextAt = group.waitTimeMs / 1000 + spawned * interval;
    if (state.waveElapsed + Number.EPSILON < nextAt) continue;
    spawnEnemy(state, group);
    state.groupSpawned[group.id] = spawned + 1;
  }
};

const updateDefenders = (state: BattleState, seconds: number) => {
  for (const defender of state.defenders) {
    defender.cooldownRemaining = Math.max(
      0,
      defender.cooldownRemaining - seconds,
    );
    const target = defender.targetId === null
      ? undefined
      : state.enemies.find((enemy) => enemy.id === defender.targetId);

    if (defender.animation === "attack_1") {
      defender.attackElapsed += seconds;
      if (
        !defender.attackApplied
        && defender.hitTimeSeconds !== null
        && defender.attackElapsed >= defender.hitTimeSeconds
        && target
        && target.animation !== "dead"
      ) {
        target.hp -= defender.attack;
        defender.attackApplied = true;
      }
      if (defender.attackElapsed >= defender.animationDurationSeconds) {
        defender.animation = "stand";
        defender.targetId = null;
      }
      continue;
    }

    if (defender.cooldownRemaining > 0) continue;
    const slot = state.config.towerSlots.find(
      (candidate) => candidate.index === defender.slotIndex,
    );
    if (!slot) continue;
    const nextTarget = state.enemies
      .filter((enemy) => enemy.animation !== "dead")
      .map((enemy) => ({
        enemy,
        position: pathPosition(state.config.path, enemy.distance),
      }))
      .filter(({ position }) => Math.hypot(
        position.x - slot.position.x,
        position.y - slot.position.y,
      ) <= defender.range)
      .sort((left, right) => right.enemy.distance - left.enemy.distance)[0]
      ?.enemy;
    if (!nextTarget) continue;

    defender.animation = "attack_1";
    defender.attackElapsed = 0;
    defender.attackApplied = false;
    defender.targetId = nextTarget.id;
    defender.cooldownRemaining = defender.cooldownSeconds;
  }
};

export const stepBattle = (
  current: BattleState,
  seconds = FIXED_STEP_SECONDS,
): BattleState => {
  if (current.status !== "active") return current;

  const state: BattleState = {
    ...current,
    groupSpawned: { ...current.groupSpawned },
    enemies: current.enemies.map((enemy) => ({ ...enemy })),
    defenders: current.defenders.map((defender) => ({ ...defender })),
  };
  state.tick += 1;
  state.elapsed += seconds;
  state.waveElapsed += seconds;
  spawnWaveGroups(state);
  updateDefenders(state, seconds);

  const totalDistance = pathLength(state.config.path);
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 && enemy.animation !== "dead") {
      enemy.animation = "dead";
      enemy.deathRemaining = 0.1;
    }
    if (enemy.animation === "dead") {
      enemy.deathRemaining -= seconds;
      continue;
    }
    enemy.distance += enemy.moveSpeed * SOURCE_SPEED_TO_LOGICAL_PIXELS * seconds;
  }

  const survivors = [];
  for (const enemy of state.enemies) {
    if (enemy.animation === "dead") {
      if (enemy.deathRemaining > 0) survivors.push(enemy);
      continue;
    }
    if (enemy.distance >= totalDistance) {
      state.baseHp -= enemy.crystalDamage;
      continue;
    }
    survivors.push(enemy);
  }
  state.enemies = survivors;

  if (state.baseHp <= 0) {
    state.baseHp = 0;
    state.status = "lost";
    return state;
  }

  const wave = state.config.waves[state.waveIndex];
  const allSpawned = wave.spawnGroups.every(
    (group) => (state.groupSpawned[group.id] ?? 0) >= group.count,
  );
  const livingEnemies = state.enemies.filter(
    (enemy) => enemy.animation !== "dead",
  ).length;
  const waveTimedOut = wave.waitTimeMs > 0
    && state.waveElapsed >= wave.waitTimeMs / 1000;
  const canAdvance = allSpawned && (
    livingEnemies <= wave.leftMonsterNextWave
    || waveTimedOut
  );
  if (canAdvance && state.waveIndex < state.config.waves.length - 1) {
    state.waveIndex += 1;
    state.waveElapsed = 0;
  } else if (
    state.waveIndex === state.config.waves.length - 1
    && allSpawned
    && state.enemies.length === 0
  ) {
    state.status = "won";
  }
  return state;
};

export const setBattlePaused = (
  state: BattleState,
  paused: boolean,
): BattleState => ({
  ...state,
  status: paused ? "paused" : state.status === "paused" ? "active" : state.status,
});
