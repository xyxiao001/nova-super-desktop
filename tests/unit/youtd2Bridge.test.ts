import { describe, expect, it } from "vitest";

import {
  createYouTd2Command,
  parseYouTd2FrameMessage,
  YOUTD2_ENGINE,
  YOUTD2_FRAME_SRC,
  YOUTD2_FRAME_SOURCE,
} from "../../src/apps/youtd2/youtd2Bridge";

describe("YouTD 2 bridge", () => {
  it("pins the selected official game source", () => {
    expect(YOUTD2_FRAME_SRC).toBe("/games/youtd2/index.html?v=3");
    expect(YOUTD2_ENGINE).toMatchObject({
      name: "YouTD 2",
      version: "Web",
      codeLicense: "MIT",
      assetLicense: "CC BY-NC 4.0",
    });
  });

  it("creates host commands with a stable source marker", () => {
    expect(createYouTd2Command("activate")).toEqual({
      source: "nova-desktop",
      type: "activate",
    });
  });

  it("accepts only known frame messages", () => {
    expect(parseYouTd2FrameMessage({
      source: YOUTD2_FRAME_SOURCE,
      type: "ready",
    })).toEqual({
      source: YOUTD2_FRAME_SOURCE,
      type: "ready",
    });
    expect(parseYouTd2FrameMessage({
      source: YOUTD2_FRAME_SOURCE,
      type: "error",
      message: "resource failed",
    })).toMatchObject({ type: "error", message: "resource failed" });
    expect(parseYouTd2FrameMessage({
      source: YOUTD2_FRAME_SOURCE,
      type: "progress",
      loaded: 64,
      total: 128,
    })).toMatchObject({ type: "progress", loaded: 64, total: 128 });
    expect(parseYouTd2FrameMessage({
      source: YOUTD2_FRAME_SOURCE,
      type: "initializing",
    })).toMatchObject({ type: "initializing" });
    expect(parseYouTd2FrameMessage({
      source: YOUTD2_FRAME_SOURCE,
      type: "progress",
      loaded: -1,
      total: 0,
    })).toBeNull();
    expect(parseYouTd2FrameMessage({
      source: YOUTD2_FRAME_SOURCE,
      type: "unknown",
    })).toBeNull();
    expect(parseYouTd2FrameMessage({
      source: "untrusted",
      type: "ready",
    })).toBeNull();
  });
});
