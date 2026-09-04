import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { loadFirstLevel } from "../../src/apps/frontline/frontlineLevel";
import type { FrontlineHeroId, FrontlineHeroRoster } from "../../src/apps/frontline/frontlineRoster";

describe("first-level targeting distance", () => {
  it("uses hero attack distance instead of the skill effect radius", async () => {
    const manifest = JSON.parse(await readFile(
      "public/assets/games/frontline/levels/desert-1/manifest.json", "utf8",
    ));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(manifest)));
    const lineup: FrontlineHeroId[] = ["summoner", "clown", "jinx", "lightning"];
    const roster = Object.fromEntries(lineup.map((id) => [id, {
      level: 1, attack: 100, pieces: 0, material: 0,
    }])) as FrontlineHeroRoster;
    try {
      const { battle } = await loadFirstLevel(lineup, roster);
      expect(battle.heroes.slice(0, 4).map((hero) => hero.range)).toEqual([210, 320, 340, 280]);
      expect(battle.lord.range).toBe(40);
      expect(battle.heroes.slice(0, 4).map((hero) => hero.animationDurationSeconds))
        .toEqual(manifest.actors.heroes.map((actor: { animations: { name: string; duration: number }[] }) => (
          actor.animations.find((animation) => animation.name === "attack_1")!.duration
        )));
    } finally {
      fetchMock.mockRestore();
    }
  });
});
