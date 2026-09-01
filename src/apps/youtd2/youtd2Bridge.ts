export const YOUTD2_FRAME_SRC = "/games/youtd2/index.html";
export const YOUTD2_FRAME_SOURCE = "nova-youtd2";
export const YOUTD2_HOST_SOURCE = "nova-desktop";

export const YOUTD2_ENGINE = {
  name: "YouTD 2",
  version: "Web",
  codeLicense: "MIT",
  assetLicense: "CC BY-NC 4.0",
  repository: "https://github.com/Praytic/youtd2",
} as const;

export type YouTd2HostCommand = {
  source: typeof YOUTD2_HOST_SOURCE;
  type: "activate" | "deactivate" | "handshake";
};

export type YouTd2FrameMessage =
  | {
      source: typeof YOUTD2_FRAME_SOURCE;
      type: "ready";
    }
  | {
      source: typeof YOUTD2_FRAME_SOURCE;
      type: "error";
      message: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

export function createYouTd2Command(
  type: YouTd2HostCommand["type"],
): YouTd2HostCommand {
  return { source: YOUTD2_HOST_SOURCE, type };
}

export function parseYouTd2FrameMessage(
  value: unknown,
): YouTd2FrameMessage | null {
  if (!isRecord(value) || value.source !== YOUTD2_FRAME_SOURCE) return null;
  if (value.type === "ready") {
    return { source: YOUTD2_FRAME_SOURCE, type: "ready" };
  }
  if (value.type === "error" && typeof value.message === "string") {
    return {
      source: YOUTD2_FRAME_SOURCE,
      type: "error",
      message: value.message,
    };
  }
  return null;
}
