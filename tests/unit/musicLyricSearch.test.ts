import { afterEach, describe, expect, it, vi } from "vitest";
import { searchLrclib, type LrclibResult } from "../../src/apps/music/lrclib";
import { lyricTypeLabel, parseLyrics } from "../../src/apps/music/lyrics";

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
