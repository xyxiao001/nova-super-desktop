import { describe, expect, it } from "vitest";
import { walkCity } from "../../src/apps/cybercity/cityLayout";

describe("night city navigation", () => {
  it("moves relative to viewing direction and normalizes diagonal speed", () => {
    expect(walkCity(0, 0, 0, 1, 0, 10)).toEqual({ x: 0, z: -10 });
    const diagonal = walkCity(0, 0, 0, 1, 1, 10);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(10);
    expect(walkCity(0, 0, Math.PI / 2, 1, 0, 5).x).toBeCloseTo(-5);
  });
  it("keeps street navigation out of the buildings and within the built block", () => {
    expect(walkCity(10, -136, 0, 1, 1, 20)).toEqual({ x: 11, z: -137 });
    expect(walkCity(0, 72, 0, -1, 0, 20).z).toBe(72);
  });
});
