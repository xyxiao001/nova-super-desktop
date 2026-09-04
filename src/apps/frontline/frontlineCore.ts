export const FIXED_STEP_SECONDS = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
const SOURCE_SPEED_TO_LOGICAL_PIXELS = 0.1;

export type Point = { x: number; y: number };
export type LightningArc = { from: Point; to: Point; remaining: number };
export type ProjectileConfig = {
  tracker: string;
  releaseTimeSeconds: number;
  projectileCount: number;
  releaseIntervalSeconds: number;
  sourceInitSpeed: number;
  maxFlyDistance: number;
  maxLifetimeSeconds: number;
  lockTarget: boolean;
  movementScale: null;
};
export type SummonConfig = {
  actorId: string;
  soldierId: number;
  maxCount: number;
  releaseTimeSeconds: number;
  bornDurationSeconds: number;
  skillNeedsTarget: boolean;
  spawnRadius: number;
  modelRadius: number;
  moveSpeed: number;
  range: number;
  seekDistance: number;
  cooldownMs: number;
  damageCoefficient: number;
  maxTargets: number;
  attackInheritance: "caller-entity-attack";
};
export type BattleStatus = "active" | "paused" | "won" | "lost";
export type ActorAnimation = "stand" | "run" | "attack_1" | "born" | "dead";

export type HeroConfig = {
  id: string;
  sourceId: number;
  name: string;
  baseAttack: number;
  damageCoefficient: number;
  cooldownMs: number;
  range: number;
  animationDurationSeconds: number;
  hitTimeSeconds: number | null;
  additionalHitTimeSeconds?: number[];
  projectile?: ProjectileConfig;
  summon?: SummonConfig;
};

export type TutorialSummonConfig = {
  heroId: string;
  slotIndex: number;
  step: number;
};

export type TutorialMergeConfig = {
  heroId: string;
  step: number;
};

export type SpawnGroupConfig = {
  id: number;
  waitTimeMs: number;
  intervalMs: number;
  count: number;
  coin: number;
  pathOffsetType: number;
  monster: {
    id: number;
    name: string;
    modelRadius: number;
    moveSpeed: number;
    hp: number;
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
  playerSlot: Point;
  towerSlots: Array<{
    index: number;
    state: "locked" | "deployable";
    priority: number;
    position: Point;
  }>;
  lord: HeroConfig;
  lordMoveSpeed: number;
  heroes: HeroConfig[];
  synthesisHeroIds: string[];
  maxSynthesisStep: number;
  lightningChain: {
    sourceId: number;
    additionalTargets: number;
    radius: number;
    damageRatio: number;
    arcDuration: number;
  } | null;
  tutorial: {
    fixedSummons: TutorialSummonConfig[];
    fixedMerges: TutorialMergeConfig[];
  };
  waves: WaveConfig[];
  economy: {
    initialCoins: number;
    baseHp: number;
    summonCosts: number[];
    strengthenCosts: number[];
    strengthenUnlockSummons: number;
  };
};

export type Enemy = {
  id: number;
  monsterId: number;
  name: string;
  actorId: string;
  hp: number;
  maxHp: number;
  modelRadius: number;
  moveSpeed: number;
  coin: number;
  crystalDamage: number;
  distance: number;
  pathOffsetType: number;
  animation: ActorAnimation;
  deathRemaining: number;
};

export type Defender = {
  id: number;
  kind: "lord" | "hero";
  slotIndex: number | null;
  actorId: string;
  sourceId: number;
  name: string;
  step: number;
  position: Point | null;
  moveTarget: Point | null;
  moveSpeed: number;
  facingX: -1 | 1;
  attack: number;
  range: number;
  cooldownSeconds: number;
  cooldownRemaining: number;
  animationDurationSeconds: number;
  hitTimeSeconds: number | null;
  attackElapsed: number;
  attackApplied: boolean;
  appliedHitCount: number;
  releasedProjectileCount: number;
  targetId: number | null;
  animation: ActorAnimation;
  damageDealt: number;
};

export type Projectile = {
  id: number;
  tracker: string;
  sourceDefenderId: number;
  targetId: number;
  position: Point;
  targetPositionAtRelease: Point;
  elapsedSeconds: number;
  maxLifetimeSeconds: number;
  sourceInitSpeed: number;
  maxFlyDistance: number;
  lockTarget: boolean;
  movementScale: null;
};

export type SummonedUnit = {
  id: number;
  ownerDefenderId: number;
  actorId: string;
  soldierId: number;
  position: Point;
  facingX: -1 | 1;
  animation: ActorAnimation;
  bornRemaining: number;
  attack: number;
  range: number;
  seekDistance: number;
  moveSpeed: number;
  modelRadius: number;
  cooldownSeconds: number;
  damageCoefficient: number;
  maxTargets: number;
};

export type BattleState = {
  config: BattleConfig;
  tick: number;
  elapsed: number;
  waveIndex: number;
  waveElapsed: number;
  groupSpawned: Record<number, number>;
  nextEnemyId: number;
  nextDefenderId: number;
  nextProjectileId: number;
  nextSummonedUnitId: number;
  enemies: Enemy[];
  defenders: Defender[];
  projectiles: Projectile[];
  summonedUnits: SummonedUnit[];
  lightningArcs: LightningArc[];
  coins: number;
  summonCount: number;
  synthesisCount: number;
  strengthenLevel: number;
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

export const pathDirection = (points: Point[], distance: number): Point => {
  let remaining = Math.max(0, distance);
  let lastDirection = { x: 0, y: 1 };
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const x = to.x - from.x;
    const y = to.y - from.y;
    const segment = Math.hypot(x, y);
    if (segment === 0) continue;
    lastDirection = { x: x / segment, y: y / segment };
    if (remaining <= segment) return lastDirection;
    remaining -= segment;
  }
  return lastDirection;
};

export const closestPathPoint = (points: Point[], point: Point): Point => {
  let closest = points[0] ?? { x: 0, y: 0 };
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const x = to.x - from.x;
    const y = to.y - from.y;
    const lengthSquared = x * x + y * y;
    const ratio = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, (
        (point.x - from.x) * x + (point.y - from.y) * y
      ) / lengthSquared));
    const candidate = { x: from.x + x * ratio, y: from.y + y * ratio };
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }
  return closest;
};

const createDefender = (
  id: number,
  hero: HeroConfig,
  kind: Defender["kind"],
  slotIndex: number | null,
  strengthenLevel = 0,
  step = 1,
  position: Point | null = null,
  moveSpeed = 0,
): Defender => ({
  id,
  kind,
  slotIndex,
  actorId: hero.id,
  sourceId: hero.sourceId,
  name: hero.name,
  step,
  position,
  moveTarget: null,
  moveSpeed,
  facingX: -1,
  attack: hero.baseAttack
    * hero.damageCoefficient / 100
    * strengthenMultiplier(strengthenLevel),
  range: hero.range,
  cooldownSeconds: hero.cooldownMs / 1000,
  cooldownRemaining: 0,
  animationDurationSeconds: hero.animationDurationSeconds,
  hitTimeSeconds: hero.hitTimeSeconds,
  attackElapsed: 0,
  attackApplied: false,
  appliedHitCount: 0,
  releasedProjectileCount: 0,
  targetId: null,
  animation: "stand",
  damageDealt: 0,
});

const strengthenMultiplier = (level: number) => 1 + level * 0.1;

const indexedCost = (costs: number[], count: number) => (
  costs[Math.min(count, costs.length - 1)] ?? Number.POSITIVE_INFINITY
);

export const summonCost = (state: BattleState) => (
  indexedCost(state.config.economy.summonCosts, state.summonCount)
);

export const strengthenCost = (state: BattleState) => (
  indexedCost(state.config.economy.strengthenCosts, state.strengthenLevel)
);

export const createBattle = (config: BattleConfig): BattleState => ({
  config,
  tick: 0,
  elapsed: 0,
  waveIndex: 0,
  waveElapsed: 0,
  groupSpawned: {},
  nextEnemyId: 1,
  nextDefenderId: 2,
  nextProjectileId: 1,
  nextSummonedUnitId: 1,
  enemies: [],
  projectiles: [],
  summonedUnits: [],
  lightningArcs: [],
  defenders: [createDefender(
    1,
    config.lord,
    "lord",
    null,
    0,
    1,
    { ...config.playerSlot },
    config.lordMoveSpeed,
  )],
  coins: config.economy.initialCoins,
  summonCount: 0,
  synthesisCount: 0,
  strengthenLevel: 0,
  baseHp: config.economy.baseHp,
  status: "active",
});

export const summonHero = (
  current: BattleState,
  heroId: string,
): BattleState => {
  if (current.status !== "active") return current;
  const tutorialSummon = current.config.tutorial.fixedSummons[current.summonCount];
  const summonedHeroId = tutorialSummon?.heroId ?? heroId;
  const hero = current.config.heroes.find(
    (candidate) => candidate.id === summonedHeroId,
  );
  const occupied = new Set(
    current.defenders.flatMap((defender) => (
      defender.slotIndex === null ? [] : [defender.slotIndex]
    )),
  );
  const slot = tutorialSummon
    ? current.config.towerSlots.find((candidate) => (
      candidate.index === tutorialSummon.slotIndex
      && candidate.state === "deployable"
      && !occupied.has(candidate.index)
    ))
    : current.config.towerSlots
      .filter((candidate) => (
        candidate.state === "deployable" && !occupied.has(candidate.index)
      ))
      .sort((left, right) => left.priority - right.priority)[0];
  const cost = summonCost(current);
  if (!hero || !slot || current.coins < cost) return current;

  return {
    ...current,
    coins: current.coins - cost,
    summonCount: current.summonCount + 1,
    nextDefenderId: current.nextDefenderId + 1,
    defenders: [
      ...current.defenders,
      createDefender(
        current.nextDefenderId,
        hero,
        "hero",
        slot.index,
        current.strengthenLevel,
        tutorialSummon?.step ?? 1,
      ),
    ],
  };
};

const resetAttack = (defender: Defender): Defender => ({
  ...defender,
  cooldownRemaining: 0,
  attackElapsed: 0,
  attackApplied: false,
  appliedHitCount: 0,
  releasedProjectileCount: 0,
  targetId: null,
  animation: "stand",
});

const moveOwnedSummons = (
  state: BattleState,
  ownerId: number,
  ownerPosition: Point,
) => state.summonedUnits.map((unit) => (
  unit.ownerDefenderId === ownerId
    ? { ...unit, position: closestPathPoint(state.config.path, ownerPosition) }
    : unit
));

export const moveLord = (current: BattleState, target: Point): BattleState => {
  if (current.status !== "active") return current;
  const lord = current.defenders.find((defender) => defender.kind === "lord");
  if (!lord?.position || Math.hypot(
    target.x - lord.position.x,
    target.y - lord.position.y,
  ) <= 40) {
    return current;
  }
  return {
    ...current,
    defenders: current.defenders.map((defender) => defender.id === lord.id
      ? {
        ...resetAttack(defender),
        moveTarget: { ...target },
        facingX: target.x < lord.position!.x ? -1 : 1,
        animation: "run",
      }
      : defender),
  };
};

export const moveOrMergeDefender = (
  current: BattleState,
  defenderId: number,
  targetSlotIndex: number,
): BattleState => {
  if (current.status !== "active") return current;
  const source = current.defenders.find(
    (defender) => defender.id === defenderId && defender.kind === "hero",
  );
  const targetSlot = current.config.towerSlots.find((slot) => (
    slot.index === targetSlotIndex && slot.state === "deployable"
  ));
  if (!source || !targetSlot || source.slotIndex === targetSlotIndex) return current;

  const target = current.defenders.find(
    (defender) => defender.slotIndex === targetSlotIndex,
  );
  if (!target) {
    const summonedUnits = moveOwnedSummons(
      current,
      source.id,
      targetSlot.position,
    );
    return {
      ...current,
      summonedUnits,
      defenders: current.defenders.map((defender) => defender.id === source.id
        ? { ...resetAttack(defender), slotIndex: targetSlotIndex }
        : defender),
    };
  }

  const canMerge = target.kind === "hero"
    && target.sourceId === source.sourceId
    && target.step === source.step
    && source.step < current.config.maxSynthesisStep;
  if (!canMerge) {
    const summonedUnits = current.summonedUnits.map((unit) => {
      if (unit.ownerDefenderId === source.id) {
        return {
          ...unit,
          position: closestPathPoint(current.config.path, targetSlot.position),
        };
      }
      if (unit.ownerDefenderId === target.id && source.slotIndex !== null) {
        const sourceSlot = current.config.towerSlots.find(
          (slot) => slot.index === source.slotIndex,
        );
        return sourceSlot
          ? {
            ...unit,
            position: closestPathPoint(current.config.path, sourceSlot.position),
          }
          : unit;
      }
      return unit;
    });
    return {
      ...current,
      summonedUnits,
      defenders: current.defenders.map((defender) => {
        if (defender.id === source.id) {
          return { ...resetAttack(defender), slotIndex: targetSlotIndex };
        }
        if (defender.id === target.id) {
          return { ...resetAttack(defender), slotIndex: source.slotIndex };
        }
        return defender;
      }),
    };
  }

  const fixedMerge = current.config.tutorial.fixedMerges[current.synthesisCount];
  const resultHeroId = fixedMerge
    ? fixedMerge.heroId
    : current.config.synthesisHeroIds[
      Math.floor(Math.random() * current.config.synthesisHeroIds.length)
    ];
  const mergedHero = current.config.heroes.find((hero) => hero.id === resultHeroId);
  if (!mergedHero) return current;
  return {
    ...current,
    synthesisCount: current.synthesisCount + 1,
    summonedUnits: current.summonedUnits.filter(
      (unit) => unit.ownerDefenderId !== source.id
        && unit.ownerDefenderId !== target.id,
    ),
    defenders: [
      ...current.defenders.filter(
        (defender) => defender.id !== source.id && defender.id !== target.id,
      ),
      createDefender(
        target.id,
        mergedHero,
        "hero",
        targetSlotIndex,
        current.strengthenLevel,
        fixedMerge ? fixedMerge.step : source.step + 1,
      ),
    ],
  };
};

export const strengthenBattle = (current: BattleState): BattleState => {
  if (
    current.status !== "active"
    || current.summonCount < current.config.economy.strengthenUnlockSummons
  ) {
    return current;
  }
  const cost = strengthenCost(current);
  if (current.coins < cost) return current;
  const nextLevel = current.strengthenLevel + 1;
  const attackRatio = strengthenMultiplier(nextLevel)
    / strengthenMultiplier(current.strengthenLevel);

  return {
    ...current,
    coins: current.coins - cost,
    strengthenLevel: nextLevel,
    defenders: current.defenders.map((defender) => ({
      ...defender,
      attack: defender.attack * attackRatio,
    })),
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
    hp: group.monster.hp,
    maxHp: group.monster.hp,
    modelRadius: group.monster.modelRadius,
    moveSpeed: group.monster.moveSpeed,
    coin: group.coin,
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

const chainLightning = (state: BattleState, defender: Defender, primary: Enemy) => {
  const chain = state.config.lightningChain;
  if (!chain || defender.sourceId !== chain.sourceId) return;
  const origin = state.config.towerSlots.find((slot) => slot.index === defender.slotIndex)!.position;
  let previous = pathPosition(state.config.path, primary.distance);
  state.lightningArcs.push({ from: { ...origin }, to: previous, remaining: chain.arcDuration });
  const hit = new Set([primary.id]);
  for (let index = 0; index < chain.additionalTargets; index += 1) {
    const next = state.enemies
      .filter((enemy) => enemy.hp > 0 && enemy.animation !== "dead" && !hit.has(enemy.id))
      .map((enemy) => {
        const point = pathPosition(state.config.path, enemy.distance);
        return { enemy, point, distance: Math.hypot(point.x - previous.x, point.y - previous.y) };
      })
      .filter((candidate) => candidate.distance <= chain.radius)
      .sort((left, right) => left.distance - right.distance)[0];
    if (!next) break;
    const damage = Math.min(next.enemy.hp, defender.attack * chain.damageRatio);
    next.enemy.hp -= damage;
    defender.damageDealt += damage;
    hit.add(next.enemy.id);
    state.lightningArcs.push({ from: previous, to: next.point, remaining: chain.arcDuration });
    previous = next.point;
  }
};

const releaseProjectile = (
  state: BattleState,
  defender: Defender,
  target: Enemy,
  origin: Point,
) => {
  const config = state.config.heroes.find(
    (hero) => hero.sourceId === defender.sourceId,
  )?.projectile;
  if (!config) return;
  state.projectiles.push({
    id: state.nextProjectileId,
    tracker: config.tracker,
    sourceDefenderId: defender.id,
    targetId: target.id,
    position: { ...origin },
    targetPositionAtRelease: pathPosition(state.config.path, target.distance),
    elapsedSeconds: 0,
    maxLifetimeSeconds: config.maxLifetimeSeconds,
    sourceInitSpeed: config.sourceInitSpeed,
    maxFlyDistance: config.maxFlyDistance,
    lockTarget: config.lockTarget,
    movementScale: config.movementScale,
  });
  state.nextProjectileId += 1;
};

const releaseSummonedUnit = (
  state: BattleState,
  defender: Defender,
  origin: Point,
) => {
  const config = state.config.heroes.find(
    (hero) => hero.sourceId === defender.sourceId,
  )?.summon;
  if (!config) return;
  const ownerCount = state.summonedUnits.filter(
    (unit) => unit.ownerDefenderId === defender.id,
  ).length;
  if (ownerCount >= config.maxCount) return;
  const position = closestPathPoint(state.config.path, origin);
  if (Math.hypot(position.x - origin.x, position.y - origin.y) > config.spawnRadius) {
    return;
  }
  state.summonedUnits.push({
    id: state.nextSummonedUnitId,
    ownerDefenderId: defender.id,
    actorId: config.actorId,
    soldierId: config.soldierId,
    position,
    facingX: -1,
    animation: "born",
    bornRemaining: config.bornDurationSeconds,
    attack: config.attackInheritance === "caller-entity-attack"
      ? defender.attack
      : 0,
    range: config.range,
    seekDistance: config.seekDistance,
    moveSpeed: config.moveSpeed,
    modelRadius: config.modelRadius,
    cooldownSeconds: config.cooldownMs / 1000,
    damageCoefficient: config.damageCoefficient,
    maxTargets: config.maxTargets,
  });
  state.nextSummonedUnitId += 1;
};

const updateSummonedUnits = (state: BattleState, seconds: number) => {
  for (const unit of state.summonedUnits) {
    if (unit.animation !== "born") continue;
    if (unit.bornRemaining <= seconds + Number.EPSILON) {
      unit.bornRemaining = 0;
      unit.animation = "stand";
    } else {
      unit.bornRemaining -= seconds;
    }
  }
};

const updateDefenders = (state: BattleState, seconds: number) => {
  for (const defender of state.defenders) {
    if (defender.kind === "lord" && defender.position && defender.moveTarget) {
      const x = defender.moveTarget.x - defender.position.x;
      const y = defender.moveTarget.y - defender.position.y;
      const distance = Math.hypot(x, y);
      const movement = defender.moveSpeed * seconds;
      if (distance <= movement) {
        defender.position = { ...defender.moveTarget };
        defender.moveTarget = null;
        defender.animation = "stand";
      } else {
        defender.position = {
          x: defender.position.x + x / distance * movement,
          y: defender.position.y + y / distance * movement,
        };
        defender.facingX = x < 0 ? -1 : 1;
        defender.animation = "run";
      }
      continue;
    }
    defender.cooldownRemaining = Math.max(
      0,
      defender.cooldownRemaining - seconds,
    );
    const target = defender.targetId === null
      ? undefined
      : state.enemies.find((enemy) => enemy.id === defender.targetId);

    if (defender.animation === "attack_1") {
      defender.attackElapsed += seconds;
      const heroConfig = state.config.heroes.find(
        (hero) => hero.sourceId === defender.sourceId,
      );
      const projectile = heroConfig?.projectile;
      const summon = heroConfig?.summon;
      if (
        !defender.attackApplied
        && summon
        && defender.attackElapsed >= summon.releaseTimeSeconds
      ) {
        const slot = state.config.towerSlots.find(
          (candidate) => candidate.index === defender.slotIndex,
        );
        const origin = defender.kind === "lord" ? defender.position : slot?.position;
        if (origin) releaseSummonedUnit(state, defender, origin);
        defender.attackApplied = true;
      }
      const releaseTime = projectile?.releaseTimeSeconds;
      if (
        !defender.attackApplied
        && projectile
        && releaseTime !== undefined
        && target
        && target.animation !== "dead"
      ) {
        const slot = state.config.towerSlots.find(
          (candidate) => candidate.index === defender.slotIndex,
        );
        const origin = defender.kind === "lord" ? defender.position : slot?.position;
        while (
          origin
          && defender.releasedProjectileCount < projectile.projectileCount
          && defender.attackElapsed >= releaseTime
            + defender.releasedProjectileCount * projectile.releaseIntervalSeconds
        ) {
          releaseProjectile(state, defender, target, origin);
          defender.releasedProjectileCount += 1;
        }
        defender.attackApplied = defender.releasedProjectileCount
          >= projectile.projectileCount;
      }
      if (
        !defender.attackApplied
        && defender.hitTimeSeconds !== null
        && target
        && target.animation !== "dead"
      ) {
        const damageConfig = defender.kind === "lord"
          ? state.config.lord
          : state.config.heroes.find((hero) => hero.sourceId === defender.sourceId);
        const hitTimes = [
          defender.hitTimeSeconds,
          ...(damageConfig?.additionalHitTimeSeconds ?? []),
        ];
        while (
          defender.appliedHitCount < hitTimes.length
          && defender.attackElapsed >= hitTimes[defender.appliedHitCount]
          && target.hp > 0
        ) {
          const damage = Math.min(target.hp, defender.attack);
          target.hp -= damage;
          defender.damageDealt += damage;
          defender.appliedHitCount += 1;
          chainLightning(state, defender, target);
        }
        defender.attackApplied = defender.appliedHitCount >= hitTimes.length
          || target.hp <= 0;
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
    const defenderPosition = defender.kind === "lord"
      ? defender.position
      : slot?.position;
    if (!defenderPosition) continue;
    const summon = state.config.heroes.find(
      (hero) => hero.sourceId === defender.sourceId,
    )?.summon;
    if (summon && !summon.skillNeedsTarget) {
      const ownerCount = state.summonedUnits.filter(
        (unit) => unit.ownerDefenderId === defender.id,
      ).length;
      if (ownerCount < summon.maxCount) {
        defender.animation = "attack_1";
        defender.attackElapsed = 0;
        defender.attackApplied = false;
        defender.appliedHitCount = 0;
        defender.releasedProjectileCount = 0;
        defender.targetId = null;
        defender.cooldownRemaining = defender.cooldownSeconds;
        continue;
      }
    }
    const nextTarget = state.enemies
      .filter((enemy) => enemy.animation !== "dead")
      .map((enemy) => ({
        enemy,
        position: pathPosition(state.config.path, enemy.distance),
      }))
      .filter(({ enemy, position }) => Math.hypot(
        position.x - defenderPosition.x,
        position.y - defenderPosition.y,
      ) <= defender.range + enemy.modelRadius)
      .sort((left, right) => right.enemy.distance - left.enemy.distance)[0]
      ?.enemy;
    if (!nextTarget) continue;

    const targetPosition = pathPosition(state.config.path, nextTarget.distance);
    defender.facingX = targetPosition.x < defenderPosition.x ? -1 : 1;
    defender.animation = "attack_1";
    defender.attackElapsed = 0;
    defender.attackApplied = false;
    defender.appliedHitCount = 0;
    defender.releasedProjectileCount = 0;
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
    summonedUnits: current.summonedUnits.map((unit) => ({
      ...unit,
      position: { ...unit.position },
    })),
    projectiles: current.projectiles
      .map((projectile) => ({
        ...projectile,
        position: { ...projectile.position },
        targetPositionAtRelease: { ...projectile.targetPositionAtRelease },
        elapsedSeconds: projectile.elapsedSeconds + seconds,
      }))
      .filter((projectile) => (
        projectile.elapsedSeconds < projectile.maxLifetimeSeconds
      )),
    lightningArcs: current.lightningArcs
      .map((arc) => ({ ...arc, remaining: arc.remaining - seconds }))
      .filter((arc) => arc.remaining > 0),
  };
  state.tick += 1;
  state.elapsed += seconds;
  state.waveElapsed += seconds;
  spawnWaveGroups(state);
  // Lua starts Soldier AI only after the Spine born animation completes. Run
  // existing summons first so a unit created later in this tick keeps the full
  // confirmed birth duration. Combat AI remains disabled until its C# states
  // are recovered.
  updateSummonedUnits(state, seconds);
  updateDefenders(state, seconds);

  const totalDistance = pathLength(state.config.path);
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 && enemy.animation !== "dead") {
      enemy.animation = "dead";
      enemy.deathRemaining = 0.1;
      state.coins += enemy.coin;
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
