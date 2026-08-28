import { describe, expect, it } from "vitest";

import {
  buyVoyageShopItem,
  createVoyageRun,
  endVoyageTurn,
  enterVoyageNode,
  generateVoyageMap,
  playVoyageCard,
  reachableVoyageNodeIds,
  type VoyageBattle,
  type VoyageState,
} from "../../app/starVoyageCore";

const battleState = (): VoyageState => {
  const state = createVoyageRun(42);
  const node = state.nodes[0];
  const battle: VoyageBattle = {
    enemyId: "drone",
    enemyHull: 32,
    enemyShield: 0,
    intentIndex: 0,
    turn: 1,
    energy: 3,
    shield: 0,
    vulnerable: 0,
    drawPile: [],
    discardPile: [],
    exhaustPile: [],
    hand: ["pulse", "brace"],
  };
  return {
    ...state,
    phase: "combat",
    currentNodeId: node.id,
    nodes: state.nodes.map((item) => item.id === node.id ? { ...item, type: "combat" } : item),
    battle,
  };
};

describe("star voyage core", () => {
  it("generates a stable connected route for a seed", () => {
    const first = generateVoyageMap(2026);
    const second = generateVoyageMap(2026);

    expect(first).toEqual(second);
    expect(first.nodes.filter((node) => node.column === 0)).toHaveLength(3);
    expect(first.nodes.filter((node) => node.type === "boss")).toHaveLength(1);
    expect(first.nodes.filter((node) => node.column < 6).every((node) => node.nextIds.length > 0)).toBe(true);
  });

  it("only enters a reachable map node and starts its encounter", () => {
    const state = createVoyageRun(7);
    const reachable = reachableVoyageNodeIds(state);
    const nodeId = reachable[0];
    const next = enterVoyageNode({
      ...state,
      nodes: state.nodes.map((node) => node.id === nodeId ? { ...node, type: "combat" } : node),
    }, nodeId);

    expect(next.phase).toBe("combat");
    expect(next.currentNodeId).toBe(nodeId);
    expect(next.battle?.hand).toHaveLength(5);
    expect(enterVoyageNode(state, "missing")).toBe(state);
  });

  it("plays attack and shield cards using energy", () => {
    let state = battleState();
    state = playVoyageCard(state, 0);
    expect(state.battle?.enemyHull).toBe(26);
    expect(state.battle?.energy).toBe(2);

    state = playVoyageCard(state, 0);
    expect(state.battle?.shield).toBe(5);
    expect(state.battle?.energy).toBe(1);
  });

  it("applies enemy intent through shield and starts the next turn", () => {
    const state = playVoyageCard(battleState(), 1);
    const next = endVoyageTurn(state);

    expect(next.hull).toBe(71);
    expect(next.battle?.shield).toBe(0);
    expect(next.battle?.turn).toBe(2);
  });

  it("opens rewards after defeating a normal encounter", () => {
    const state = battleState();
    const next = playVoyageCard({
      ...state,
      battle: { ...state.battle!, enemyHull: 4, hand: ["pulse"] },
    }, 0);

    expect(next.phase).toBe("reward");
    expect(next.rewards).toHaveLength(3);
    expect(next.battlesWon).toBe(1);
  });

  it("buys an affordable shop item once", () => {
    const state: VoyageState = {
      ...createVoyageRun(8),
      phase: "shop",
      credits: 50,
      shop: [{ key: "repair", kind: "repair", price: 20 }],
      hull: 20,
    };
    const next = buyVoyageShopItem(state, "repair");

    expect(next.credits).toBe(30);
    expect(next.hull).toBe(38);
    expect(next.shop).toEqual([]);
    expect(buyVoyageShopItem({ ...state, hull: state.maxHull }, "repair").credits).toBe(50);
  });
});
