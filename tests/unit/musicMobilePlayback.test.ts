import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LyricView } from "../../src/apps/music/LyricViews";
import { parseLyrics } from "../../src/apps/music/lyrics";
import { connectMediaSession, publishMediaTrack } from "../../src/apps/music/mediaSession";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("renders word gradients only for the current line of 刚刚好", () => {
  const source = readFileSync("public/music/gangganghao.lrc", "utf8");
  const lyrics = parseLyrics(source, 250.5);
  const line = lyrics.lines.find((row) => row.text.includes("如果有人在灯塔"))!;
  const html = renderToStaticMarkup(createElement(LyricView, {
    lyrics, time: line.start + 0.1, seek: () => {},
  }));
  expect(lyrics.lines.reduce((count, row) => count + row.words.length, 0)).toBeGreaterThan(300);
  expect(html.match(/class="nm-word"/g)).toHaveLength(line.words.length);
  expect(html.match(/<button/g)).toHaveLength(lyrics.lines.length);
  expect(html).toContain("拨弄她的头发");

  const before = renderToStaticMarkup(createElement(LyricView, {
    lyrics, time: -1, seek: () => {},
  }));
  expect(before).not.toContain('class="nm-word"');
  expect(before).toContain("如果有人在灯塔");
});

function fakeSession() {
  return {
    metadata: null as MediaMetadata | null,
    playbackState: "none" as MediaSessionPlaybackState,
    setActionHandler: vi.fn<MediaSession["setActionHandler"]>(),
    setPositionState: vi.fn(),
  };
}

describe("browser media session", () => {
  it("publishes song metadata and releases its artwork when replaced", () => {
    vi.stubGlobal("MediaMetadata", class {
      constructor(init: MediaMetadataInit) { Object.assign(this, init); }
    });
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const session = fakeSession();
    const clear = publishMediaTrack(session as unknown as MediaSession, {
      title: "刚刚好", artist: "薛之谦", album: "初学者",
      cover: new Blob(["cover"], { type: "image/jpeg" }),
    });
    expect(session.metadata).toMatchObject({ title: "刚刚好", artist: "薛之谦", album: "初学者" });
    const artwork = session.metadata!.artwork[0];
    expect(artwork.src).toMatch(/^blob:/);
    expect(artwork.type).toBe("image/jpeg");
    clear();
    expect(session.metadata).toBeNull();
    expect(revoke).toHaveBeenCalledWith(artwork.src);
  });

  it("routes native controls and tracks playback position and cleanup", () => {
    const audio = Object.assign(new EventTarget(), {
      duration: NaN, currentTime: 0, playbackRate: 1,
    });
    const session = fakeSession();
    const actions = { play: vi.fn(), pause: vi.fn(), previous: vi.fn(), next: vi.fn(), seek: vi.fn() };
    const disconnect = connectMediaSession(audio as HTMLAudioElement, session as unknown as MediaSession, actions);
    const handlers = new Map(session.setActionHandler.mock.calls);
    for (const action of ["play", "pause", "previoustrack", "nexttrack"] as const)
      handlers.get(action)!({ action });
    handlers.get("seekto")!({ action: "seekto", seekTime: 42 });
    for (const action of [actions.play, actions.pause, actions.previous, actions.next])
      expect(action).toHaveBeenCalledOnce();
    expect(actions.seek).toHaveBeenCalledWith(42);

    audio.dispatchEvent(new Event("timeupdate"));
    expect(session.setPositionState).not.toHaveBeenCalled();
    Object.assign(audio, { duration: 250, currentTime: 38 });
    audio.dispatchEvent(new Event("loadedmetadata"));
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 250, position: 38, playbackRate: 1 });
    audio.dispatchEvent(new Event("play"));
    expect(session.playbackState).toBe("playing");
    audio.dispatchEvent(new Event("pause"));
    expect(session.playbackState).toBe("paused");
    disconnect();
    expect(session.playbackState).toBe("none");
    for (const action of handlers.keys())
      expect(session.setActionHandler).toHaveBeenCalledWith(action, null);
    session.setPositionState.mockClear();
    audio.dispatchEvent(new Event("timeupdate"));
    expect(session.setPositionState).not.toHaveBeenCalled();
  });
});
