import { describe, expect, it } from "vitest";

import {
  formatResourceBytes,
  resourceLoadPercent,
} from "../../src/platform/resources/ResourceLoadProgress";

describe("resource load progress", () => {
  it("formats transferred bytes for compact status text", () => {
    expect(formatResourceBytes(0)).toBe("0 B");
    expect(formatResourceBytes(1_024)).toBe("1.0 KB");
    expect(formatResourceBytes(125_256_848)).toBe("119.5 MB");
  });

  it("normalizes determinate progress", () => {
    expect(resourceLoadPercent(64, 128)).toBe(50);
    expect(resourceLoadPercent(200, 128)).toBe(100);
    expect(resourceLoadPercent(1, 0)).toBeNull();
    expect(resourceLoadPercent()).toBeNull();
  });
});
