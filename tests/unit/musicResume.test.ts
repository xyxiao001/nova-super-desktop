import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { createPlaybackResume } from "../../src/apps/music/playbackResume";
import { initialPreferences, type Track } from "../../src/apps/music/model";
import { readLibrary, removeTrack, replaceLibrary, savePlayback, savePreferences, saveTracks } from "../../src/apps/music/storage";
import provider from "../../src/apps/music/storageProvider";

afterEach(() => vi.unstubAllGlobals());

describe("resume position and media readiness", () => {
  const media = () => Object.assign(new EventTarget(), {
    readyState: 0, currentTime: 0, ended: false, play: vi.fn(),
  });
  it("waits for metadata without starting playback and retains the position while loading", () => {
    const audio = media();
    const resume = createPlaybackResume(audio as unknown as HTMLAudioElement);
    resume.seekWhenReady(83.5);
    expect(audio.currentTime).toBe(0);
    expect(resume.position()).toBe(83.5);
    audio.readyState = 1;
    audio.dispatchEvent(new Event("loadedmetadata"));
    expect(audio.currentTime).toBe(83.5);
    expect(audio.play).not.toHaveBeenCalled();
    resume.dispose();
  });
  it("does not apply the previous song's pending position after switching sources", () => {
    const audio = media();
    const resume = createPlaybackResume(audio as unknown as HTMLAudioElement);
    resume.seekWhenReady(83.5);
    resume.clear();
    audio.dispatchEvent(new Event("loadedmetadata"));
    expect(audio.currentTime).toBe(0);
    expect(resume.position()).toBe(0);
    resume.seekWhenReady(42);
    resume.dispose();
    audio.dispatchEvent(new Event("loadedmetadata"));
    expect(audio.currentTime).toBe(0);
  });
  it("seeks immediately when ready and records a finished song at its beginning", () => {
    const audio = media();
    audio.readyState = 1;
    const resume = createPlaybackResume(audio as unknown as HTMLAudioElement);
    resume.seekWhenReady(20);
    expect(audio.currentTime).toBe(20);
    audio.currentTime = 180;
    audio.ended = true;
    expect(resume.position()).toBe(0);
    resume.dispose();
  });
});

const song = (id: string): Track => ({
  id, name: `${id}.wav`, title: id, artist: "测试歌手", album: "测试专辑",
  audio: new Blob([id], { type: "audio/wav" }), cover: null,
  duration: 180, lyrics: "测试歌词", lyricName: "", offset: 0,
  added: 1, favorite: false, source: "local",
});
const bookmark = { trackId: "a", time: 83.5, queue: ["a", "b"] };

describe("playback bookmark lifecycle", () => {
  beforeEach(() => replaceLibrary({ tracks: [], lyrics: [], prefs: initialPreferences }));
  it("leaves existing libraries without a bookmark and stores no second copy of audio", async () => {
    await saveTracks([song("a"), song("b")]);
    expect((await readLibrary()).playback).toBeUndefined();
    await savePlayback(bookmark);
    const library = await readLibrary();
    expect(library.playback).toEqual(bookmark);
    expect(library.tracks).toHaveLength(2);
    expect(await library.tracks[0].audio.text()).toBe("a");
  });
  it("keeps preference changes independent from frequent position writes", async () => {
    await saveTracks([song("a"), song("b")]);
    await Promise.all([
      savePlayback(bookmark),
      savePreferences({ ...initialPreferences, volume: 0.3, mode: "repeat" }),
    ]);
    const library = await readLibrary();
    expect(library.playback).toEqual(bookmark);
    expect(library.prefs).toMatchObject({ volume: 0.3, mode: "repeat" });
  });
  it("removes deleted songs from the queue and deletes the bookmark with its song", async () => {
    await saveTracks([song("a"), song("b")]);
    await savePlayback(bookmark);
    expect(await removeTrack("b")).toEqual({ ...bookmark, queue: ["a"] });
    expect((await readLibrary()).playback).toEqual({ ...bookmark, queue: ["a"] });
    expect(await removeTrack("a")).toBeUndefined();
    expect((await readLibrary()).playback).toBeUndefined();
  });
  it("maps bookmarks to the retained identity during existing audio deduplication", async () => {
    await replaceLibrary({
      tracks: [song("a"), { ...song("a"), id: "duplicate", added: 2 }, song("b")],
      lyrics: [], prefs: initialPreferences,
      playback: { trackId: "duplicate", time: 42, queue: ["duplicate", "a", "b"] },
    });
    const library = await readLibrary();
    expect(library.playback).toEqual({ trackId: "a", time: 42, queue: ["a", "b"] });
    expect((await readLibrary()).playback).toEqual(library.playback);
  });
  it("backs up, clears and restores the exact playback state through the music provider", async () => {
    vi.stubGlobal("window", new EventTarget());
    await saveTracks([song("a"), song("b")]);
    await savePlayback(bookmark);
    const backup = await provider.exportData();
    await provider.clear();
    expect((await readLibrary()).playback).toBeUndefined();
    await provider.restoreData(backup);
    expect((await readLibrary()).playback).toEqual(bookmark);
    await replaceLibrary({ tracks: [song("a")], lyrics: [], prefs: initialPreferences });
    expect((await readLibrary()).playback).toBeUndefined();
  });
});
