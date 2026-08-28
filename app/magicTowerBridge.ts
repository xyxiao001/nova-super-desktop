import type { GameResult } from "./gameStorage";

export const MAGIC_TOWER_FRAME_SRC = "/games/magic-tower/index.html";
export const MAGIC_TOWER_FRAME_SOURCE = "nova-magic-tower";
export const MAGIC_TOWER_HOST_SOURCE = "nova-desktop";

export const MAGIC_TOWER_ENGINE = {
  name: "人类：开天辟地",
  version: "完整版",
  license: "MIT",
  repository: "https://github.com/unanmed/HumanBreak",
} as const;

export type MagicTowerHostCommand = {
  source: typeof MAGIC_TOWER_HOST_SOURCE;
  type: "activate" | "deactivate" | "handshake" | "new-game";
};

export type MagicTowerFrameMessage =
  | {
      source: typeof MAGIC_TOWER_FRAME_SOURCE;
      type: "ready";
    }
  | {
      source: typeof MAGIC_TOWER_FRAME_SOURCE;
      type: "progress";
      progress: string;
    }
  | {
      source: typeof MAGIC_TOWER_FRAME_SOURCE;
      type: "finished";
      result: GameResult;
    }
  | {
      source: typeof MAGIC_TOWER_FRAME_SOURCE;
      type: "error";
      message: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

export function createMagicTowerCommand(
  type: MagicTowerHostCommand["type"],
): MagicTowerHostCommand {
  return { source: MAGIC_TOWER_HOST_SOURCE, type };
}

export function parseMagicTowerFrameMessage(
  value: unknown,
): MagicTowerFrameMessage | null {
  if (!isRecord(value) || value.source !== MAGIC_TOWER_FRAME_SOURCE) return null;
  if (value.type === "ready") {
    return { source: MAGIC_TOWER_FRAME_SOURCE, type: "ready" };
  }
  if (value.type === "progress" && typeof value.progress === "string") {
    return {
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "progress",
      progress: value.progress,
    };
  }
  if (
    value.type === "finished"
    && (value.result === "win" || value.result === "loss" || value.result === "draw")
  ) {
    return {
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "finished",
      result: value.result,
    };
  }
  if (value.type === "error" && typeof value.message === "string") {
    return {
      source: MAGIC_TOWER_FRAME_SOURCE,
      type: "error",
      message: value.message,
    };
  }
  return null;
}
