import { RNG } from "rot-js";

export type VoyageNodeType = "combat" | "elite" | "event" | "shop" | "repair" | "boss";
export type VoyagePhase = "map" | "combat" | "reward" | "event" | "shop" | "repair" | "won" | "lost";
export type CardType = "attack" | "system" | "tactic";

export type VoyageCardId =
  | "pulse"
  | "brace"
  | "overcharge"
  | "repair-drone"
  | "ion-burst"
  | "phase-shield"
  | "scatter"
  | "capacitor"
  | "scan"
  | "corrosion"
  | "plasma";

export type VoyageRelicId = "reactor" | "plating" | "lens";

export type VoyageCard = {
  id: VoyageCardId;
  name: string;
  detail: string;
  cost: number;
  type: CardType;
  attack?: number;
  hits?: number;
  block?: number;
  heal?: number;
  draw?: number;
  energy?: number;
  vulnerable?: number;
  exhaust?: boolean;
};

export type VoyageNode = {
  id: string;
  column: number;
  row: number;
  type: VoyageNodeType;
  nextIds: string[];
};

export type EnemyIntent = {
  kind: "attack" | "guard" | "charge";
  value: number;
  hits?: number;
  label: string;
};

export type EnemyDefinition = {
  id: string;
  name: string;
  title: string;
  maxHull: number;
  intents: EnemyIntent[];
  art: "drone" | "raider" | "guardian" | "warden";
};

export type VoyageBattle = {
  enemyId: string;
  enemyHull: number;
  enemyShield: number;
  intentIndex: number;
  turn: number;
  energy: number;
  shield: number;
  vulnerable: number;
  drawPile: VoyageCardId[];
  discardPile: VoyageCardId[];
  exhaustPile: VoyageCardId[];
  hand: VoyageCardId[];
};

export type VoyageShopItem =
  | { key: string; kind: "card"; cardId: VoyageCardId; price: number }
  | { key: string; kind: "repair"; price: number }
  | { key: string; kind: "relic"; relicId: VoyageRelicId; price: number };

export type VoyageEvent = {
  id: "derelict" | "beacon" | "storm";
  title: string;
  detail: string;
};

export type VoyageState = {
  version: 1;
  seed: number;
  rngState: number[];
  phase: VoyagePhase;
  nodes: VoyageNode[];
  currentNodeId: string | null;
  visitedNodeIds: string[];
  hull: number;
  maxHull: number;
  credits: number;
  deck: VoyageCardId[];
  relics: VoyageRelicId[];
  battle: VoyageBattle | null;
  rewards: VoyageCardId[];
  shop: VoyageShopItem[];
  event: VoyageEvent | null;
  score: number;
  battlesWon: number;
  log: string[];
};

export const VOYAGE_CARDS: Record<VoyageCardId, VoyageCard> = {
  pulse: { id: "pulse", name: "脉冲炮", detail: "造成 6 点伤害", cost: 1, type: "attack", attack: 6 },
  brace: { id: "brace", name: "稳态护盾", detail: "获得 5 点护盾", cost: 1, type: "system", block: 5 },
  overcharge: { id: "overcharge", name: "超频齐射", detail: "造成 4 点伤害，抽 1 张牌", cost: 1, type: "attack", attack: 4, draw: 1 },
  "repair-drone": { id: "repair-drone", name: "维修蜂群", detail: "修复 6 点舰体", cost: 2, type: "system", heal: 6, exhaust: true },
  "ion-burst": { id: "ion-burst", name: "离子爆发", detail: "造成 12 点伤害", cost: 2, type: "attack", attack: 12 },
  "phase-shield": { id: "phase-shield", name: "相位屏障", detail: "获得 9 点护盾", cost: 1, type: "system", block: 9, exhaust: true },
  scatter: { id: "scatter", name: "散射弹幕", detail: "造成 3×2 点伤害", cost: 1, type: "attack", attack: 3, hits: 2 },
  capacitor: { id: "capacitor", name: "电容释放", detail: "获得 1 点能量", cost: 0, type: "tactic", energy: 1, exhaust: true },
  scan: { id: "scan", name: "深空扫描", detail: "抽 2 张牌", cost: 0, type: "tactic", draw: 2, exhaust: true },
  corrosion: { id: "corrosion", name: "腐蚀信标", detail: "施加 2 层易伤", cost: 1, type: "tactic", vulnerable: 2 },
  plasma: { id: "plasma", name: "等离子长矛", detail: "造成 22 点伤害", cost: 3, type: "attack", attack: 22 },
};

export const VOYAGE_RELICS: Record<VoyageRelicId, { name: string; detail: string }> = {
  reactor: { name: "零点反应堆", detail: "每场战斗额外获得 1 点能量" },
  plating: { name: "陶瓷装甲", detail: "舰体上限提高 10" },
  lens: { name: "聚焦透镜", detail: "所有攻击额外造成 2 点伤害" },
};

export const VOYAGE_ENEMIES: Record<string, EnemyDefinition> = {
  drone: { id: "drone", name: "拾荒蜂群", title: "自治采掘编队", maxHull: 32, art: "drone", intents: [
    { kind: "attack", value: 6, label: "切割光束" },
    { kind: "guard", value: 7, label: "碎片屏障" },
    { kind: "attack", value: 4, hits: 2, label: "双联穿刺" },
  ] },
  raider: { id: "raider", name: "赤潮掠夺舰", title: "边境私掠者", maxHull: 44, art: "raider", intents: [
    { kind: "attack", value: 8, label: "船首炮" },
    { kind: "charge", value: 0, label: "武器充能" },
    { kind: "attack", value: 14, label: "过载轰击" },
  ] },
  guardian: { id: "guardian", name: "环带守卫", title: "精英防卫核心", maxHull: 62, art: "guardian", intents: [
    { kind: "guard", value: 10, label: "偏转矩阵" },
    { kind: "attack", value: 10, label: "磁轨炮" },
    { kind: "attack", value: 6, hits: 2, label: "交叉火力" },
  ] },
  warden: { id: "warden", name: "星门典狱长", title: "终局指挥舰", maxHull: 96, art: "warden", intents: [
    { kind: "attack", value: 11, label: "重力撕裂" },
    { kind: "guard", value: 14, label: "星门护盾" },
    { kind: "charge", value: 0, label: "核心临界" },
    { kind: "attack", value: 9, hits: 2, label: "湮灭脉冲" },
  ] },
};

const STARTER_DECK: VoyageCardId[] = [
  "pulse", "pulse", "pulse", "pulse", "pulse",
  "brace", "brace", "brace", "brace", "overcharge",
];

const rngFor = (state: Pick<VoyageState, "rngState">) => RNG.clone().setState(state.rngState);
const withLog = (state: VoyageState, message: string) => ({ ...state, log: [message, ...state.log].slice(0, 8) });

const randomNodeType = (column: number, rng: ReturnType<typeof RNG.clone>): VoyageNodeType => {
  const roll = rng.getUniform();
  if ((column === 2 || column === 4) && roll < .2) return "elite";
  if (roll < .53) return "combat";
  if (roll < .7) return "event";
  if (roll < .85) return "repair";
  return "shop";
};

export function generateVoyageMap(seed: number) {
  const rng = RNG.clone().setSeed(seed);
  const rows = [3, 3, 3, 3, 3, 2, 1];
  const nodes: VoyageNode[] = [];
  rows.forEach((count, column) => {
    for (let row = 0; row < count; row += 1) {
      nodes.push({
        id: `n-${column}-${row}`,
        column,
        row,
        type: column === rows.length - 1 ? "boss" : randomNodeType(column, rng),
        nextIds: [],
      });
    }
  });
  for (const node of nodes.filter((item) => item.column < rows.length - 1)) {
    const next = nodes.filter((item) => item.column === node.column + 1);
    const normalized = node.row / Math.max(1, rows[node.column] - 1);
    const nearest = [...next].sort((a, b) => (
      Math.abs(a.row / Math.max(1, next.length - 1) - normalized)
      - Math.abs(b.row / Math.max(1, next.length - 1) - normalized)
    ));
    node.nextIds.push(nearest[0].id);
    if (nearest[1] && rng.getUniform() < .48) node.nextIds.push(nearest[1].id);
  }
  return { nodes, rngState: rng.getState() };
}

export function createVoyageRun(seed = Date.now()) {
  const generated = generateVoyageMap(seed);
  return {
    version: 1,
    seed,
    rngState: generated.rngState,
    phase: "map",
    nodes: generated.nodes,
    currentNodeId: null,
    visitedNodeIds: [],
    hull: 72,
    maxHull: 72,
    credits: 35,
    deck: [...STARTER_DECK],
    relics: [],
    battle: null,
    rewards: [],
    shop: [],
    event: null,
    score: 0,
    battlesWon: 0,
    log: ["航线已校准，等待跃迁指令"],
  } satisfies VoyageState;
}

export function reachableVoyageNodeIds(state: VoyageState) {
  if (state.phase !== "map") return [];
  if (!state.currentNodeId) return state.nodes.filter((node) => node.column === 0).map((node) => node.id);
  return state.nodes.find((node) => node.id === state.currentNodeId)?.nextIds ?? [];
}

const drawCards = (
  state: VoyageState,
  battle: VoyageBattle,
  count: number,
) => {
  const rng = rngFor(state);
  const next = {
    ...battle,
    hand: [...battle.hand],
    drawPile: [...battle.drawPile],
    discardPile: [...battle.discardPile],
  };
  for (let index = 0; index < count; index += 1) {
    if (!next.drawPile.length && next.discardPile.length) {
      next.drawPile = rng.shuffle(next.discardPile);
      next.discardPile = [];
    }
    const card = next.drawPile.shift();
    if (card) next.hand.push(card);
  }
  return { battle: next, rngState: rng.getState() };
};

const enemyForNode = (node: VoyageNode, rng: ReturnType<typeof RNG.clone>) => {
  if (node.type === "boss") return VOYAGE_ENEMIES.warden;
  if (node.type === "elite") return VOYAGE_ENEMIES.guardian;
  return rng.getUniform() < .5 ? VOYAGE_ENEMIES.drone : VOYAGE_ENEMIES.raider;
};

const startBattle = (state: VoyageState, node: VoyageNode) => {
  const rng = rngFor(state);
  const enemy = enemyForNode(node, rng);
  const initial: VoyageBattle = {
    enemyId: enemy.id,
    enemyHull: enemy.maxHull,
    enemyShield: 0,
    intentIndex: 0,
    turn: 1,
    energy: 3 + (state.relics.includes("reactor") ? 1 : 0),
    shield: 0,
    vulnerable: 0,
    drawPile: rng.shuffle(state.deck),
    discardPile: [],
    exhaustPile: [],
    hand: [],
  };
  const drawn = drawCards({ ...state, rngState: rng.getState() }, initial, 5);
  return withLog({
    ...state,
    phase: "combat",
    rngState: drawn.rngState,
    battle: drawn.battle,
  }, `${enemy.name}进入交战距离`);
};

const randomCards = (state: VoyageState, count: number) => {
  const rng = rngFor(state);
  const pool = Object.keys(VOYAGE_CARDS).filter((id) => id !== "pulse" && id !== "brace") as VoyageCardId[];
  return { cards: rng.shuffle(pool).slice(0, count), rngState: rng.getState() };
};

const makeShop = (state: VoyageState) => {
  const cards = randomCards(state, 3);
  const rng = RNG.clone().setState(cards.rngState);
  const relicPool = (Object.keys(VOYAGE_RELICS) as VoyageRelicId[]).filter((id) => !state.relics.includes(id));
  const relicId = rng.getItem(relicPool);
  const shop: VoyageShopItem[] = cards.cards.map((cardId, index) => ({
    key: `card-${index}-${cardId}`,
    kind: "card",
    cardId,
    price: 18 + VOYAGE_CARDS[cardId].cost * 5,
  }));
  shop.push({ key: "repair", kind: "repair", price: 20 });
  if (relicId) shop.push({ key: `relic-${relicId}`, kind: "relic", relicId, price: 48 });
  return { shop, rngState: rng.getState() };
};

const makeEvent = (state: VoyageState) => {
  const rng = rngFor(state);
  const ids: VoyageEvent["id"][] = ["derelict", "beacon", "storm"];
  const id = rng.getItem(ids)!;
  const events: Record<VoyageEvent["id"], VoyageEvent> = {
    derelict: { id, title: "漂流的档案舰", detail: "残骸仍在发送微弱的识别信号，货舱没有完全失压。" },
    beacon: { id, title: "静默中继站", detail: "一座旧时代中继站保存着完整的战术演算模块。" },
    storm: { id, title: "电磁风暴", detail: "航道被离子云覆盖，绕行安全但会错过补给窗口。" },
  };
  return { event: events[id], rngState: rng.getState() };
};

export function enterVoyageNode(state: VoyageState, nodeId: string): VoyageState {
  if (!reachableVoyageNodeIds(state).includes(nodeId)) return state;
  const node = state.nodes.find((item) => item.id === nodeId)!;
  let next: VoyageState = {
    ...state,
    currentNodeId: node.id,
    visitedNodeIds: [...state.visitedNodeIds, node.id],
  };
  if (node.type === "combat" || node.type === "elite" || node.type === "boss") return startBattle(next, node);
  if (node.type === "event") {
    const generated = makeEvent(next);
    return { ...next, phase: "event", event: generated.event, rngState: generated.rngState };
  }
  if (node.type === "shop") {
    const generated = makeShop(next);
    return { ...next, phase: "shop", shop: generated.shop, rngState: generated.rngState };
  }
  return { ...next, phase: "repair" };
}

export function currentEnemyIntent(state: VoyageState) {
  if (!state.battle) return null;
  const enemy = VOYAGE_ENEMIES[state.battle.enemyId];
  return enemy.intents[state.battle.intentIndex % enemy.intents.length];
}

export function playVoyageCard(state: VoyageState, handIndex: number) {
  const battle = state.battle;
  if (state.phase !== "combat" || !battle) return state;
  const cardId = battle.hand[handIndex];
  const card = VOYAGE_CARDS[cardId];
  if (!card || card.cost > battle.energy) return state;
  const hand = [...battle.hand];
  hand.splice(handIndex, 1);
  const attackBonus = state.relics.includes("lens") ? 2 : 0;
  const hits = card.hits ?? 1;
  const rawDamage = card.attack ? (card.attack + attackBonus) * hits : 0;
  const damage = battle.vulnerable > 0 ? Math.ceil(rawDamage * 1.5) : rawDamage;
  const absorbed = Math.min(battle.enemyShield, damage);
  let nextBattle: VoyageBattle = {
    ...battle,
    hand,
    energy: battle.energy - card.cost + (card.energy ?? 0),
    shield: battle.shield + (card.block ?? 0),
    enemyShield: battle.enemyShield - absorbed,
    enemyHull: Math.max(0, battle.enemyHull - (damage - absorbed)),
    vulnerable: battle.vulnerable + (card.vulnerable ?? 0),
    discardPile: card.exhaust ? battle.discardPile : [...battle.discardPile, cardId],
    exhaustPile: card.exhaust ? [...battle.exhaustPile, cardId] : battle.exhaustPile,
  };
  let nextState: VoyageState = {
    ...state,
    hull: Math.min(state.maxHull, state.hull + (card.heal ?? 0)),
    battle: nextBattle,
  };
  if (card.draw) {
    const drawn = drawCards(nextState, nextBattle, card.draw);
    nextBattle = drawn.battle;
    nextState = { ...nextState, battle: nextBattle, rngState: drawn.rngState };
  }
  nextState = withLog(nextState, `${card.name}${damage ? `造成 ${damage} 点伤害` : "已执行"}`);
  if (nextBattle.enemyHull > 0) return nextState;
  const node = state.nodes.find((item) => item.id === state.currentNodeId)!;
  if (node.type === "boss") {
    return withLog({
      ...nextState,
      phase: "won",
      battle: null,
      score: nextState.score + 500,
      battlesWon: nextState.battlesWon + 1,
    }, "星门典狱长已解除武装");
  }
  const rewards = randomCards(nextState, 3);
  return withLog({
    ...nextState,
    phase: "reward",
    battle: null,
    rewards: rewards.cards,
    rngState: rewards.rngState,
    credits: nextState.credits + (node.type === "elite" ? 35 : 20),
    score: nextState.score + (node.type === "elite" ? 180 : 100),
    battlesWon: nextState.battlesWon + 1,
  }, "交战结束，打捞到战术模块");
}

export function endVoyageTurn(state: VoyageState) {
  const battle = state.battle;
  const intent = currentEnemyIntent(state);
  if (state.phase !== "combat" || !battle || !intent) return state;
  const totalDamage = intent.kind === "attack" ? intent.value * (intent.hits ?? 1) : 0;
  const hullDamage = Math.max(0, totalDamage - battle.shield);
  if (state.hull - hullDamage <= 0) {
    return withLog({ ...state, phase: "lost", hull: 0, battle: null }, "舰体完整度归零，远征终止");
  }
  let enemyShield = battle.enemyShield;
  if (intent.kind === "guard") enemyShield += intent.value;
  const base: VoyageBattle = {
    ...battle,
    enemyShield,
    intentIndex: battle.intentIndex + 1,
    turn: battle.turn + 1,
    energy: 3 + (state.relics.includes("reactor") ? 1 : 0),
    shield: 0,
    vulnerable: Math.max(0, battle.vulnerable - 1),
    discardPile: [...battle.discardPile, ...battle.hand],
    hand: [],
  };
  const drawn = drawCards({ ...state, rngState: state.rngState }, base, 5);
  return withLog({
    ...state,
    hull: state.hull - hullDamage,
    battle: drawn.battle,
    rngState: drawn.rngState,
  }, intent.kind === "attack" ? `${intent.label}造成 ${hullDamage} 点舰体伤害` : `${intent.label}强化敌方护盾`);
}

const returnToMap = (state: VoyageState) => ({
  ...state,
  phase: "map" as const,
  rewards: [],
  shop: [],
  event: null,
});

export function chooseVoyageReward(state: VoyageState, cardId?: VoyageCardId) {
  if (state.phase !== "reward") return state;
  return returnToMap({
    ...state,
    deck: cardId && state.rewards.includes(cardId) ? [...state.deck, cardId] : state.deck,
  });
}

export function resolveVoyageEvent(state: VoyageState, choice: 0 | 1) {
  if (state.phase !== "event" || !state.event) return state;
  if (state.event.id === "derelict") {
    return returnToMap(choice === 0
      ? withLog({ ...state, hull: Math.max(1, state.hull - 8), credits: state.credits + 32 }, "回收货舱，舰体受损 8")
      : withLog({ ...state, hull: Math.min(state.maxHull, state.hull + 8) }, "保持距离并完成临时维修"));
  }
  if (state.event.id === "beacon") {
    return returnToMap(choice === 0
      ? withLog({ ...state, deck: [...state.deck, "scan"] }, "下载深空扫描模块")
      : withLog({ ...state, credits: state.credits + 18 }, "出售中继站坐标"));
  }
  return returnToMap(choice === 0
    ? withLog({ ...state, hull: Math.max(1, state.hull - 6), score: state.score + 60 }, "穿越风暴，获得航程优势")
    : withLog({ ...state, credits: Math.max(0, state.credits - 10) }, "支付燃料绕行风暴"));
}

export function buyVoyageShopItem(state: VoyageState, key: string) {
  if (state.phase !== "shop") return state;
  const item = state.shop.find((entry) => entry.key === key);
  if (!item || item.price > state.credits || (item.kind === "repair" && state.hull >= state.maxHull)) return state;
  let next: VoyageState = { ...state, credits: state.credits - item.price, shop: state.shop.filter((entry) => entry.key !== key) };
  if (item.kind === "card") next = { ...next, deck: [...next.deck, item.cardId] };
  if (item.kind === "repair") next = { ...next, hull: Math.min(next.maxHull, next.hull + 18) };
  if (item.kind === "relic") {
    next = { ...next, relics: [...next.relics, item.relicId] };
    if (item.relicId === "plating") next = { ...next, maxHull: next.maxHull + 10, hull: next.hull + 10 };
  }
  return withLog(next, "星港交易已完成");
}

export function leaveVoyageShop(state: VoyageState) {
  return state.phase === "shop" ? returnToMap(state) : state;
}

export function resolveVoyageRepair(state: VoyageState, choice: "repair" | "remove") {
  if (state.phase !== "repair") return state;
  if (choice === "repair") {
    return returnToMap(withLog({ ...state, hull: Math.min(state.maxHull, state.hull + Math.ceil(state.maxHull * .3)) }, "维修站恢复舰体完整度"));
  }
  const index = state.deck.findIndex((card) => card === "pulse" || card === "brace");
  return returnToMap(withLog({
    ...state,
    deck: index >= 0 ? state.deck.filter((_, cardIndex) => cardIndex !== index) : state.deck,
  }, "移除一张基础模块"));
}
