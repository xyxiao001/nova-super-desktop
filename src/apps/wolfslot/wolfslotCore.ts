export type SlotSymbolId = "bar" | "seven" | "star" | "melon" | "bell" | "plum" | "orange" | "apple" | "wolf";
export type SlotOutcomeKind = "normal" | "wolf" | "eaten" | "train" | "big-three" | "small-three" | "big-four" | "grand-slam";
export type SlotOutcome = {
  kind: SlotOutcomeKind;
  label: string;
  detail: string;
  landing: number;
  targets: number[];
  special: boolean;
};
export type SlotLossProtection = {
  streak: number;
  accumulatedLoss: number;
};

export const SLOT_PATH: SlotSymbolId[] = ["orange","bell","bar","bar","bar","apple","plum","melon","melon","wolf","apple","orange","orange","bell","seven","seven","apple","plum","plum","star","star","wolf","apple","bell"];
export const SLOT_LOSS_PROTECTION_TRIGGER = 4;
export const SLOT_MULTIPLIERS: Record<SlotSymbolId, number> = {
  bar:120,
  seven:40,
  star:30,
  melon:20,
  bell:20,
  plum:15,
  orange:10,
  apple:5,
  wolf:0,
};

export const totalSlotBet = (bets: Partial<Record<SlotSymbolId, number>>) =>
  Object.values(bets).reduce((total, value) => total + (value ?? 0), 0);

export function getSlotSpinSteps(current: number, destination: number) {
  const distance = (destination - current + SLOT_PATH.length) % SLOT_PATH.length || SLOT_PATH.length;
  return SLOT_PATH.length * 2 + distance;
}

export function resolveSlotRound(
  currentBets: Partial<Record<SlotSymbolId, number>>,
  lastBets: Partial<Record<SlotSymbolId, number>>,
) {
  const currentTotal = totalSlotBet(currentBets);
  if (currentTotal > 0) return { bets: currentBets, total: currentTotal, repeated: false };
  const lastTotal = totalSlotBet(lastBets);
  return { bets: lastBets, total: lastTotal, repeated: lastTotal > 0 };
}

const indicesOf = (symbol: SlotSymbolId) => SLOT_PATH.flatMap((item, index) => item === symbol ? [index] : []);
const pick = (values: number[], random: () => number) => values[Math.floor(random() * values.length) % values.length];

const NORMAL_OUTCOME_WEIGHTS: Array<[SlotSymbolId, number]> = [
  ["apple", .09],
  ["orange", .12],
  ["plum", .12],
  ["bell", .11],
  ["melon", .11],
  ["star", .15],
  ["seven", .09],
  ["bar", .06],
];

export function createSlotOutcome(random: () => number = Math.random): SlotOutcome {
  const roll = random();
  let boundary = 0;
  for (const [symbol, probability] of NORMAL_OUTCOME_WEIGHTS) {
    boundary += probability;
    if (roll < boundary) {
      const landing = pick(indicesOf(symbol), random);
      return { kind:"normal", label:"普通奖", detail:"单灯结算", landing, targets:[landing], special:false };
    }
  }
  const landing = pick(indicesOf("wolf"), random);
  return { kind:"wolf", label:"开火车", detail:"狼灯触发 · 奖励行驶中", landing, targets:[], special:true };
}

export function createTrainReward(landing: number, random: () => number = Math.random): SlotOutcome {
  const reward = random();
  if (reward < .45) return { kind:"eaten", label:"火车被吃", detail:"狼吞掉了本轮奖金", landing, targets:[], special:true };
  if (reward < .75) {
    const length = 4 + Math.floor(random() * 3);
    const start = Math.floor(random() * SLOT_PATH.length);
    return { kind:"train", label:"开火车", detail:`狼灯送出 · 连续 ${length} 站`, landing, targets:Array.from({length}, (_, index) => (start + index) % SLOT_PATH.length), special:true };
  }
  if (reward < .88) return { kind:"small-three", label:"小三元", detail:"狼灯送出 · 铃铛、李子、橙子", landing, targets:[pick(indicesOf("bell"), random),pick(indicesOf("plum"), random),pick(indicesOf("orange"), random)], special:true };
  if (reward < .95) return { kind:"big-three", label:"大三元", detail:"狼灯送出 · 77、双星、西瓜", landing, targets:[pick(indicesOf("seven"), random),pick(indicesOf("star"), random),pick(indicesOf("melon"), random)], special:true };
  if (reward < .985) return { kind:"big-four", label:"大四喜", detail:"狼灯送出 · 四枚大苹果", landing, targets:indicesOf("apple").slice(0, 4), special:true };
  return { kind:"grand-slam", label:"大满贯", detail:"狼灯送出 · 全盘中奖", landing, targets:SLOT_PATH.flatMap((symbol, index) => symbol === "wolf" ? [] : [index]), special:true };
}

export function settleSlotLossProtection(
  wager: number,
  payout: number,
  current: SlotLossProtection,
) {
  const netLoss = Math.max(0, wager - payout);
  if (netLoss === 0) {
    return { compensation:0, next:{ streak:0, accumulatedLoss:0 } };
  }
  const next = {
    streak: current.streak + 1,
    accumulatedLoss: current.accumulatedLoss + netLoss,
  };
  if (next.streak < SLOT_LOSS_PROTECTION_TRIGGER) {
    return { compensation:0, next };
  }
  return {
    compensation: Math.max(1, Math.floor(next.accumulatedLoss * .5)),
    next: { streak:0, accumulatedLoss:0 },
  };
}

export function calculateSlotPayout(
  bets: Partial<Record<SlotSymbolId, number>>,
  targets: number[],
) {
  return targets.reduce((total, index) => {
    const symbol = SLOT_PATH[index];
    return total + (bets[symbol] ?? 0) * SLOT_MULTIPLIERS[symbol];
  }, 0);
}
