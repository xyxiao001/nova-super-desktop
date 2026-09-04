import { describe, expect, it } from "vitest";
import { drawRecruitHeroes } from "../../src/apps/frontline/FrontlineRecruit";

describe("frontline recruitment", () => {
  it("draws the requested number of heroes from the four-hero pool", () => {
    expect(drawRecruitHeroes(10, () => 0.5)).toEqual(
      Array.from({ length: 10 }, () => "jinx"),
    );
  });

  it("maps deterministic random boundaries to valid hero ids", () => {
    const values = [0, 0.249999, 0.25, 0.5, 0.999999, 1];
    let index = 0;

    expect(drawRecruitHeroes(values.length, () => values[index++])).toEqual([
      "summoner",
      "summoner",
      "clown",
      "jinx",
      "lightning",
      "lightning",
    ]);
  });

  it("returns no results for a zero-count draw", () => {
    expect(drawRecruitHeroes(0, () => 0)).toEqual([]);
  });
});
