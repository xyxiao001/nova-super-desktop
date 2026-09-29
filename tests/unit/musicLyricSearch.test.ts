import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bestLyricMatch, findTrackLyrics, searchLrclib, type LrclibResult } from "../../src/apps/music/lrclib";
import { lyricTypeLabel, parseLyrics } from "../../src/apps/music/lyrics";
import { LyricSearch } from "../../src/apps/music/LyricSearch";
import { LyricView } from "../../src/apps/music/LyricViews";

afterEach(() => vi.unstubAllGlobals());

describe("LRCLIB lyric search", () => {
  it.each([
    ["[00:01.250]第一行\n[00:05.500]第二行", "逐行歌词"],
    ["[00:01.000]你[00:02.000]好[00:03.000]", "逐字歌词"],
    ["[00:01]<00:01.000>你<00:02.000>好<00:03.000>", "逐字歌词"],
    ["[1000,2000](1000,500,0)你(1500,1500,0)好", "逐字歌词"],
    ["[1000,2000]你(1000,500)好(1500,1500)", "逐字歌词"],
    ["第一行\n第二行", "纯文本歌词"],
  ])("labels the actual lyric timing: %s", (source, label) => {
    expect(lyricTypeLabel(parseLyrics(source))).toBe(label);
  });

  it("encodes the query and preserves both lyric formats and version metadata", async () => {
    const candidate: LrclibResult = {
      id: 42,
      trackName: "测试歌曲 (Live)",
      artistName: "测试歌手",
      albumName: "现场专辑",
      duration: 180,
      instrumental: false,
      syncedLyrics: "[00:01.250]第一行\n[00:05.500]第二行",
      plainLyrics: "第一行\n第二行",
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json([candidate]));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const results = await searchLrclib("测试歌曲 & 测试歌手", controller.signal);

    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get("q")).toBe("测试歌曲 & 测试歌手");
    expect(options.signal).toBe(controller.signal);
    expect(results).toEqual([candidate]);
    const lyrics = parseLyrics(results[0].syncedLyrics!, results[0].duration);
    expect(lyrics.lines.map(({ text, start, end }) => ({ text, start, end }))).toEqual([
      { text: "第一行", start: 1.25, end: 5.5 },
      { text: "第二行", start: 5.5, end: 180 },
    ]);
    expect(parseLyrics(results[0].plainLyrics!).timed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns no candidates when the source has no matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    await expect(searchLrclib("无匹配歌曲", new AbortController().signal)).resolves.toEqual([]);
  });

  it("reports a failed request without retrying or switching sources", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchLrclib("测试", new AbortController().signal)).rejects.toThrow("LRCLIB 请求失败 (429)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("automatic lyric matching", () => {
  const track = { title: "刚刚好", artist: "薛之谦", album: "初学者", duration: 250.5 };
  const candidate = (overrides: Partial<LrclibResult> = {}): LrclibResult => ({
    id: 1, trackName: track.title, artistName: track.artist, albumName: track.album,
    duration: track.duration, instrumental: false, syncedLyrics: "[00:01]第一行", plainLyrics: "第一行",
    ...overrides,
  });

  it("searches by title alone and selects the matching artist and recording", async () => {
    const best = candidate({ id: 4 });
    const fetchMock = vi.fn().mockResolvedValue(Response.json([
      candidate({ id: 1, artistName: "翻唱歌手" }),
      candidate({ id: 2, duration: 300 }),
      candidate({ id: 3, trackName: "刚刚好 (Live)" }),
      best,
    ]));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await expect(findTrackLyrics(track, controller.signal)).resolves.toEqual(best);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("q")).toBe("刚刚好");
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prioritizes the song title over matching artist metadata", () => {
    const cover = candidate({ artistName: "翻唱歌手" });
    expect(bestLyricMatch(track, [candidate({ trackName: "刚好" }), cover])).toBe(cover);
  });

  it("compares normalized names and prefers synced lyrics for the same recording", () => {
    const synced = candidate({ id: 2, trackName: " ＴＥＳＴ！ " });
    expect(bestLyricMatch({ ...track, title: "test" }, [
      candidate({ trackName: "test", syncedLyrics: null }), synced,
    ])).toBe(synced);
  });

  it("supports plain lyrics and excludes candidates without lyric text", () => {
    const plain = candidate({ syncedLyrics: null });
    expect(bestLyricMatch(track, [candidate({ syncedLyrics: " ", plainLyrics: null }), plain])).toBe(plain);
    expect(bestLyricMatch(track, [candidate({ instrumental: true, syncedLyrics: null, plainLyrics: null })])).toBeUndefined();
    expect(bestLyricMatch(track, [])).toBeUndefined();
  });

  it("does not retry a failed automatic search", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(findTrackLyrics(track, new AbortController().signal)).rejects.toThrow("offline");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("defaults manual search to the song title", () => {
    const html = renderToStaticMarkup(createElement(LyricSearch, { title: track.title, onPreview: () => {} }));
    expect(html).toContain('value="刚刚好"');
  });

  it("shows searching while lyrics are empty and replaces it with matched lyrics", () => {
    const props = { time: 0, seek: () => {}, searching: true };
    const loading = renderToStaticMarkup(createElement(LyricView, { ...props, lyrics: parseLyrics("") }));
    expect(loading).toContain("歌词搜索中");
    expect(loading).toContain('role="status"');
    const loaded = renderToStaticMarkup(createElement(LyricView, { ...props, lyrics: parseLyrics("[00:01]匹配的歌词") }));
    expect(loaded).toContain("匹配的歌词");
    expect(loaded).not.toContain("歌词搜索中");
  });
});
