import { afterEach, describe, expect, it, vi } from "vitest";
import { GOMOKU_DIFFICULTIES, GOMOKU_SEARCH_PROFILES } from "../../src/apps/gomoku/gomokuDifficulty";

describe("gomoku difficulty",()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it("offers four named levels including grandmaster",()=>{
    expect(GOMOKU_DIFFICULTIES.map((item)=>item.label)).toEqual(["休闲","进阶","大师","特级大师"]);
  });

  it("increases search breadth and depth for the strongest level",()=>{
    const master=GOMOKU_SEARCH_PROFILES.master;
    const grandmaster=GOMOKU_SEARCH_PROFILES.grandmaster;
    expect(grandmaster.candidateGrowthFactor).toBeGreaterThan(master.candidateGrowthFactor);
    expect(grandmaster.stages[0].maxCandidates).toBeGreaterThan(master.stages[0].maxCandidates);
    expect(grandmaster.deepSearchDepth).toBe(24);
  });

  it("returns a valid move from a grandmaster midgame search",async()=>{
    const postMessage=vi.fn();
    const workerScope:{postMessage:typeof postMessage;onmessage?:(event:unknown)=>void}={postMessage};
    vi.stubGlobal("self",workerScope);
    await import("../../src/apps/gomoku/gomoku.worker");
    const moves=[
      {row:7,column:7,player:1 as const},{row:7,column:8,player:0 as const},
      {row:8,column:8,player:1 as const},{row:6,column:6,player:0 as const},
      {row:8,column:7,player:1 as const},{row:6,column:8,player:0 as const},
      {row:9,column:8,player:1 as const},{row:5,column:7,player:0 as const},
    ];
    workerScope.onmessage?.({data:{moves,player:1,difficulty:"grandmaster",requestId:9}});
    const result=postMessage.mock.calls[0][0] as {row:number;column:number;requestId:number};
    expect(result.requestId).toBe(9);
    expect(result.row).toBeGreaterThanOrEqual(0);
    expect(result.row).toBeLessThan(15);
    expect(result.column).toBeGreaterThanOrEqual(0);
    expect(result.column).toBeLessThan(15);
    expect(moves.some((move)=>move.row===result.row&&move.column===result.column)).toBe(false);
  });
});
