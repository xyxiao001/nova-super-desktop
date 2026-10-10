import { beforeEach, describe, expect, it, vi } from "vitest";
import Hls from "hls.js";
import { startHlsPlayback } from "../../src/apps/radio/hlsPlayback";

const player = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => void>(),
  attachMedia: vi.fn(), loadSource: vi.fn(), stopLoad: vi.fn(), destroy: vi.fn(),
}));
vi.mock("hls.js", () => {
  const policy = { default: { maxTimeToFirstByteMs: 10000, maxLoadTimeMs: 20000, errorRetry: {}, timeoutRetry: {} } };
  return { default: Object.assign(vi.fn(function () {
    return { ...player, on: (event: string, handler: (...args: unknown[]) => void) => player.handlers.set(event, handler) };
  }), {
    Events: { MANIFEST_PARSED: "ready", ERROR: "error" },
    DefaultConfig: { manifestLoadPolicy: policy, playlistLoadPolicy: policy, fragLoadPolicy: policy, keyLoadPolicy: policy },
  }) };
});
beforeEach(() => { vi.clearAllMocks(); player.handlers.clear(); });

describe("radio HLS playback", () => {
  it("starts playback when the playlist is ready and releases the player on stop", () => {
    const audio = {} as HTMLAudioElement;
    const ready = vi.fn();
    const stop = startHlsPlayback(audio, "https://example.com/live.m3u8", ready, vi.fn());
    expect(player.attachMedia).toHaveBeenCalledWith(audio);
    expect(player.loadSource).toHaveBeenCalledWith("https://example.com/live.m3u8");
    expect(ready).not.toHaveBeenCalled();
    player.handlers.get("ready")!();
    expect(ready).toHaveBeenCalledOnce();
    stop();
    expect(player.destroy).toHaveBeenCalledOnce();
  });

  it("stops loading and reports a fatal stream failure without recovery", () => {
    const fail = vi.fn();
    startHlsPlayback({} as HTMLAudioElement, "https://example.com/live.m3u8", vi.fn(), fail);
    player.handlers.get("error")!("error", { fatal: true });
    expect(player.stopLoad).toHaveBeenCalledOnce();
    expect(fail).toHaveBeenCalledOnce();
  });

  it("disables automatic network retries for the new HLS streams", () => {
    startHlsPlayback({} as HTMLAudioElement, "https://example.com/live.m3u8", vi.fn(), vi.fn());
    const config = vi.mocked(Hls).mock.calls[0][0]!;
    for (const key of ["manifestLoadPolicy", "playlistLoadPolicy", "fragLoadPolicy", "keyLoadPolicy"] as const) {
      expect(config[key]?.default.errorRetry).toBeNull();
      expect(config[key]?.default.timeoutRetry).toBeNull();
    }
  });
});
