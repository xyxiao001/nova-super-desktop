import { describe, expect, it } from "vitest";

import {
  createMagicTowerCommand,
  MAGIC_TOWER_ENGINE,
  MAGIC_TOWER_FRAME_SOURCE,
  parseMagicTowerFrameMessage,
} from "../../app/magicTowerBridge";

describe("magic tower bridge", () => {
  it("pins the selected complete game source", () => {
    expect(MAGIC_TOWER_ENGINE).toMatchObject({
      name: "人类：开天辟地",
      version: "完整版",
      license: "MIT",
    });
  });

  it("creates host commands with a stable source marker", () => {
    expect(createMagicTowerCommand("new-game")).toEqual({
      source: "nova-desktop",
      type: "new-game",
    });
  });

  it("accepts only known frame messages", () => {
    expect(parseMagicTowerFrameMessage({
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "ready",
    })).toEqual({
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "ready",
    });
    expect(parseMagicTowerFrameMessage({
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "progress",
      progress: "{\"floor\":\"MT1\"}",
    })).toMatchObject({ type: "progress" });
    expect(parseMagicTowerFrameMessage({
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "finished",
      result: "win",
    })).toMatchObject({ type: "finished", result: "win" });
    expect(parseMagicTowerFrameMessage({
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "error",
      message: "resource failed",
    })).toMatchObject({ type: "error", message: "resource failed" });
    expect(parseMagicTowerFrameMessage({
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "finished",
      result: "unknown",
    })).toBeNull();
    expect(parseMagicTowerFrameMessage({
      source: "untrusted",
      type: "ready",
    })).toBeNull();
  });
});
