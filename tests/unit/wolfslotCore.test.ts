import { describe, expect, it } from "vitest";

import {
  calculateSlotPayout,
  createSlotOutcome,
  createTrainReward,
  getSlotSpinSteps,
  resolveSlotRound,
  settleSlotLossProtection,
  SLOT_LOSS_PROTECTION_TRIGGER,
  SLOT_PATH,
  type SlotSymbolId,
} from "../../src/apps/wolfslot/wolfslotCore";

const bets = (values: Partial<Record<SlotSymbolId, number>> = {}) => ({
  bar:0,seven:0,star:0,melon:0,bell:0,plum:0,orange:0,apple:0,wolf:0,...values,
});
const sequence = (...values: number[]) => {
  let index = 0;
  return () => values[index++] ?? 0;
};

describe("wolf slot outcomes", () => {
  it("finishes the lamp animation on the selected destination", () => {
    for (const current of [0, 7, 18, 23]) {
      for (const destination of [0, 5, 12, 23]) {
        expect((current + getSlotSpinSteps(current, destination)) % SLOT_PATH.length).toBe(destination);
      }
    }
  });

  it("repeats the previous complete bet when GO has no new bet", () => {
    expect(resolveSlotRound({ apple: 0 }, { apple: 5 })).toEqual({ bets: { apple: 5 }, total: 5, repeated: true });
    expect(resolveSlotRound({ bar: 1 }, { apple: 5 })).toEqual({ bets: { bar: 1 }, total: 1, repeated: false });
  });

  it("uses five percent wolf landings and waits to decide the train reward", () => {
    expect(createSlotOutcome(sequence(.949, 0)).kind).toBe("normal");
    const outcome = createSlotOutcome(sequence(.97, .1));
    expect(outcome).toMatchObject({kind:"wolf",special:true,targets:[]});
    expect(SLOT_PATH[outcome.landing]).toBe("wolf");
  });

  it("can swallow the train without a reward", () => {
    expect(createTrainReward(9, sequence(.2))).toMatchObject({kind:"eaten",landing:9,targets:[]});
  });

  it("creates a 4-6 stop consecutive train after the animation", () => {
    const outcome = createTrainReward(9, sequence(.7, .99, .9));
    expect(outcome.kind).toBe("train");
    expect(outcome.targets).toHaveLength(6);
    expect(outcome.targets.every((value, index) => index === 0 || value === (outcome.targets[index - 1] + 1) % SLOT_PATH.length)).toBe(true);
  });

  it("creates the classic big-three symbols", () => {
    const outcome = createTrainReward(21, sequence(.94, 0, 0, 0));
    expect(outcome.kind).toBe("big-three");
    expect(outcome.targets.map((index) => SLOT_PATH[index])).toEqual(["seven", "star", "melon"]);
  });

  it("keeps non-wolf stops as a normal single result", () => {
    const outcome = createSlotOutcome(sequence(.01, 0));
    expect(outcome).toMatchObject({kind:"normal",landing:5,targets:[5],special:false});
  });

  it("adds every lit target to a special payout", () => {
    const appleTargets = SLOT_PATH.flatMap((symbol, index) => symbol === "apple" ? [index] : []).slice(0, 4);
    expect(calculateSlotPayout(bets({apple:3}), appleTargets)).toBe(60);
  });

  it("refunds half of accumulated net losses on the fourth losing round", () => {
    let protection = { streak:0, accumulatedLoss:0 };
    for (let round = 1; round < SLOT_LOSS_PROTECTION_TRIGGER; round += 1) {
      const settlement = settleSlotLossProtection(10, 2, protection);
      expect(settlement.compensation).toBe(0);
      protection = settlement.next;
    }
    expect(settleSlotLossProtection(10, 2, protection)).toEqual({
      compensation:16,
      next:{streak:0,accumulatedLoss:0},
    });
  });

  it("resets loss protection after a round that breaks even", () => {
    expect(settleSlotLossProtection(10, 10, {streak:3,accumulatedLoss:24})).toEqual({
      compensation:0,
      next:{streak:0,accumulatedLoss:0},
    });
  });
});
