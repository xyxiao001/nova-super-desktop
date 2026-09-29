import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";
import {
  parseLyrics,
  activeLine,
  wordProgress,
} from "../../src/apps/music/lyrics";
import {
  lyricCandidates,
  initialPreferences,
  type Track,
} from "../../src/apps/music/model";
import { importMusic } from "../../src/apps/music/importMusic";
import {
  readLibrary,
  replaceLibrary,
  saveTracks,
  saveLyrics,
  savePreferences,
  removeTrack,
} from "../../src/apps/music/storage";
import provider from "../../src/apps/music/storageProvider";
afterEach(() => vi.unstubAllGlobals());
import {
  catalogTrackInLibrary,
  audioFingerprint,
} from "../../src/apps/music/deduplication";
describe("music lyrics", () => {
  it("keeps repeated row timestamps as separate complete lines", () => {
    const p = parseLyrics(
      "[offset:-150]\n[00:01.20][00:08.345]重复的句子\n[00:12]结束",
    );
    expect(p.offset).toBe(-0.15);
    expect(p.lines.map((l) => [l.start, l.text])).toEqual([
      [1.2, "重复的句子"],
      [8.345, "重复的句子"],
      [12, "结束"],
    ]);
    expect(activeLine(p.lines, 9)).toBe(1);
  });
  it("parses interleaved square words and preserves spaces and final word", () => {
    const p = parseLyrics(
      "[00:01.000]喜欢[00:02.000] 你[00:03.000]\n[00:04.000]最后",
    );
    expect(p.lines[0].text).toBe("喜欢 你");
    expect(p.lines[0].words).toHaveLength(2);
    expect(wordProgress(p.lines[0].words[0], 1.5)).toBe(50);
    expect(wordProgress(p.lines[0].words[0], 2)).toBe(100);
    expect(activeLine(p.lines, 0)).toBe(-1);
  });
  it("parses enhanced LRC and row timestamps without fractions", () => {
    const p = parseLyrics(
      "[00:10]<00:10.000>你<00:11.000>好<00:12.000>\n[00:13]下一行",
    );
    expect(p.lines[0].text).toBe("你好");
    expect(p.lines[0].words[1].end).toBe(12);
  });
  it("parses SRT and VTT, including cue end gaps", () => {
    for (const text of [
      "1\n00:00:01,200 --> 00:00:02,500\nHello\nworld",
      "WEBVTT\n\n00:01.200 --> 00:02.500\nHello\nworld",
    ]) {
      const p = parseLyrics(text);
      expect(p.lines[0]).toMatchObject({
        start: 1.2,
        end: 2.5,
        text: "Hello\nworld",
      });
      expect(activeLine(p.lines, 3)).toBe(-1);
    }
  });
  it("parses plaintext YRC and QRC timing", () => {
    expect(
      parseLyrics("[1000,2000](1000,500,0)你(1500,1500,0)好").lines[0].words[1],
    ).toEqual({ start: 1.5, end: 3, text: "好" });
    expect(
      parseLyrics("[1000,2000]你(1000,500)好(1500,1500)").lines[0].words[1],
    ).toEqual({ start: 1.5, end: 3, text: "好" });
  });
  it("keeps plain text untimed and supports long word lyrics", async () => {
    expect(parseLyrics("第一行\n第二行").timed).toBe(false);
    {
      const source = await readFile("tests/fixtures/music/word-lyrics.lrc", "utf8");
      expect(source.length).toBeGreaterThan(4000);
      const p = parseLyrics(source);
      expect(p.lines.length).toBeLessThan(150);
      expect(p.lines.filter((l) => l.words.length).length).toBeGreaterThan(30);
      expect(
        p.lines.flatMap((l) => l.words).every((w) => w.end >= w.start),
      ).toBe(true);
    }
  });
  it("parses ordinary LRC as rows", async () => {
    const p = parseLyrics("[00:01.200]第一行\n[00:05.400]第二行");
    expect(p.timed).toBe(true);
    expect(p.lines.every((l) => !l.words.length)).toBe(true);
  });
});
it("uses song duration for the final word and accepts indented timestamps", () => {
  const result = parseLyrics("  [00:10]<00:10.000>结<00:11.000>尾", 12);
  expect(result.lines[0].words[1].end).toBe(12);
  expect(wordProgress(result.lines[0].words[1], 11.5)).toBe(50);
});

describe("matching and true audio metadata", () => {
  it("matches reversed filename tokens and metadata titles", () => {
    const track = {
      name: "汪苏泷 - 耿.mp3",
      title: "耿 (《最好的我们》电影毕业季主题曲)",
      artist: "汪苏泷",
    };
    expect(
      lyricCandidates(track, [{ id: "1", name: "耿 - 汪苏泷.lrc", text: "" }]),
    ).toHaveLength(1);
  });
  it("preserves ambiguous best matches for manual association", () => {
    const track = {
      name: "薛之谦 - 刚刚好.mp3",
      title: "刚刚好",
      artist: "薛之谦",
    };
    expect(
      lyricCandidates(track, [
        { id: "1", name: "刚刚好.lrc", text: "" },
        { id: "2", name: "薛之谦 - 刚刚好.lrc", text: "" },
      ]),
    ).toHaveLength(2);
    expect(
      lyricCandidates(track, [{ id: "3", name: "崇拜.lrc", text: "" }]),
    ).toHaveLength(0);
  });
  it("extracts the real cover and duration from an encoded audio fixture", async () => {
    const bytes = await readFile("tests/fixtures/music/metadata.mp3");
    const t = await importMusic(
      new File([bytes], "测试歌手 - 测试歌曲.mp3", { type: "audio/mpeg" }),
    );
    expect(t.title).toBe("测试歌曲");
    expect(t.duration).toBeGreaterThanOrEqual(0.25);
    expect(t.duration).toBeLessThan(0.4);
    expect(t.cover?.size).toBeGreaterThan(100);
    expect(t.audio.size).toBe(bytes.length);
  });
});
describe("persistent music library", () => {
  const track: Track = {
    id: "song",
    name: "a.mp3",
    title: "歌曲",
    artist: "歌手",
    album: "专辑",
    audio: new Blob(["audio"], { type: "audio/mpeg" }),
    cover: new Blob(["cover"], { type: "image/png" }),
    duration: 123,
    lyrics: "",
    lyricName: "",
    offset: 0,
    added: 1,
    favorite: false,
    source: "local",
  };
  beforeEach(async () => {
    await replaceLibrary({ tracks: [], lyrics: [], prefs: initialPreferences });
  });
  it("persists lyrics added later to an existing song, cover and preferences", async () => {
    expect((await readLibrary()).prefs.spectrumVisible).toBe(false);
    await saveTracks([track]);
    await saveTracks([
      { ...track, lyrics: "[00:01]新歌词", lyricName: "a.lrc", offset: 0.3 },
    ]);
    await saveLyrics([{ id: "lrc", name: "a.lrc", text: "[00:01]新歌词" }]);
    await savePreferences({
      ...initialPreferences,
      theme: "dark",
      spectrumVisible: true,
      playlists: [{ id: "p", name: "歌单", tracks: ["song"] }],
    });
    const d = await readLibrary();
    expect(d.tracks[0].lyrics).toContain("新歌词");
    expect(await d.tracks[0].cover!.text()).toBe("cover");
    expect(d.prefs.playlists[0].tracks).toEqual(["song"]);
    expect(d.prefs.spectrumVisible).toBe(true);
    await savePreferences({ ...d.prefs, spectrumVisible: false });
    expect((await readLibrary()).prefs.spectrumVisible).toBe(false);
    await removeTrack("song");
    expect((await readLibrary()).tracks).toHaveLength(0);
  });
  it("backs up and restores authored performances and playlist shows in the existing music store", async () => {
    vi.stubGlobal("window", new EventTarget());
    const performance = { view: { scene: "concert" as const, camera: "front" as const, palette: "rose" as const } };
    const show = { title: "周五夜场", transition: "fade" as const, roles: { song: "encore" as const } };
    await saveTracks([{ ...track, performance }]);
    await savePreferences({ ...initialPreferences, playlists: [{ id:"show",name:"夜场",tracks:[track.id],show }] });
    const backup = await provider.exportData();
    await provider.clear();
    expect((await readLibrary()).tracks).toHaveLength(0);
    await provider.restoreData(backup);
    const restored = await readLibrary();
    expect(restored.tracks[0].performance).toEqual(performance);
    expect(restored.prefs.playlists[0].show).toEqual(show);
  });
  it("merges existing local/catalog duplicates and preserves lyrics, favorites and playlist references", async () => {
    await replaceLibrary({
      tracks: [
        track,
        {
          ...track,
          id: "catalog",
          source: "catalog",
          added: 2,
          favorite: true,
          lyrics: "[00:01]关联歌词",
          lyricName: "歌曲.lrc",
          offset: 0.2,
        },
      ],
      lyrics: [],
      prefs: {
        ...initialPreferences,
        playlists: [{ id: "p", name: "喜欢", tracks: ["catalog", "song"] }],
      },
    });
    const result = await readLibrary();
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      id: "song",
      favorite: true,
      lyrics: "[00:01]关联歌词",
      offset: 0.2,
    });
    expect(result.prefs.playlists[0].tracks).toEqual(["song"]);
    expect((await readLibrary()).tracks).toHaveLength(1);
  });
  it("deduplicates repeats in one batch and concurrent local/catalog writes", async () => {
    await Promise.all([
      saveTracks([track, { ...track, id: "batch-duplicate", added: 2 }]),
      saveTracks([{ ...track, id: "catalog", added: 3 }]),
    ]);
    expect((await readLibrary()).tracks).toHaveLength(1);
    const repeated = await saveTracks([
      { ...track, id: "renamed", name: "renamed.mp3", added: 4 },
    ]);
    expect(repeated.mergedCount).toBe(1);
    expect(repeated.tracks[0].id).toBe("song");
  });
  it("does not merge different recordings with the same song metadata", async () => {
    await saveTracks([
      track,
      { ...track, id: "live", audio: new Blob(["other recording"]) },
    ]);
    expect((await readLibrary()).tracks).toHaveLength(2);
  });
  it("keeps edited lyrics and retains a different duplicate lyric as an available file", async () => {
    await saveTracks([
      { ...track, lyrics: "我的编辑", lyricName: "edited.lrc" },
    ]);
    const result = await saveTracks([
      {
        ...track,
        id: "duplicate",
        added: 2,
        lyrics: "原版歌词",
        lyricName: "original.lrc",
      },
    ]);
    expect(result.tracks[0].lyrics).toBe("我的编辑");
    expect(result.lyrics).toContainEqual({
      id: "merged-duplicate",
      name: "original.lrc",
      text: "原版歌词",
    });
  });
  it("recognizes a local file in the online catalogue and plays its retained ID", async () => {
    const result = await saveTracks([track]);
    const item = {
      id: "catalog",
      title: track.title,
      artist: track.artist,
      album: track.album,
      audio: "/music/song.mp3",
      lyrics: "/music/song.lrc",
      cover: null,
      bytes: track.audio.size,
      audioHash: await audioFingerprint(track.audio),
    };
    expect(catalogTrackInLibrary(item, result.tracks)?.id).toBe("song");
  });
  it("exports audio and cover bytes instead of empty blob JSON", async () => {
    await saveTracks([track]);
    const b = (await provider.exportData()) as {
      tracks: { audio: { data: string }; cover: { data: string } }[];
    };
    expect(atob(b.tracks[0].audio.data)).toBe("audio");
    expect(atob(b.tracks[0].cover.data)).toBe("cover");
    expect(provider.validateData(b)).toBe(true);
  });
});
