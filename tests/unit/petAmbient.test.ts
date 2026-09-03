import { describe, expect, it } from "vitest";

import {
  PET_AMBIENT_IDLE_MS,
  createPetAmbientMoment,
} from "../../app/petAmbient";

describe("desktop pet ambient moments", () => {
  it("maps bubble frequency to increasingly quiet idle intervals", () => {
    expect(PET_AMBIENT_IDLE_MS.high).toBeLessThan(PET_AMBIENT_IDLE_MS.medium);
    expect(PET_AMBIENT_IDLE_MS.medium).toBeLessThan(PET_AMBIENT_IDLE_MS.low);
  });

  it("cycles through local poses without requiring AI", () => {
    const moments = Array.from({ length: 4 }, (_, sequence) => (
      createPetAmbientMoment({
        sequence,
        personality: "quiet",
        visibleItemCount: 3,
        hour: 15,
      })
    ));

    expect(moments.map(({ activity }) => activity)).toEqual([
      "rest",
      "groom",
      "stretch",
      "bathe",
    ]);
    expect(moments.every(({ text }) => text.length > 0)).toBe(true);
  });

  it("offers a generic desktop reminder without exposing item details", () => {
    expect(createPetAmbientMoment({
      sequence: 4,
      personality: "curious",
      visibleItemCount: 12,
      hour: 15,
    })).toEqual({
      activity: "stretch",
      text: "桌面有点热闹，要不要找时间整理一下？",
    });
  });

  it("uses a calm local line late at night", () => {
    expect(createPetAmbientMoment({
      sequence: 0,
      personality: "lively",
      visibleItemCount: 2,
      hour: 23,
    })).toEqual({
      activity: "rest",
      text: "夜深啦，我陪你把手头这点做完。",
    });
  });
});
