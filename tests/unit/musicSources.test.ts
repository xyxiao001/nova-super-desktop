import { createDecipheriv } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { getWordLyrics, rankSongs, searchSongs } from "../../scripts/music/netease.mjs";
import { decodeQrc } from "../../scripts/music/qq.mjs";
import { parseLyrics } from "../../src/apps/music/lyrics";

afterEach(() => vi.unstubAllGlobals());

it("searches NetEase by title and keeps artist and duration for matching", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 200, result: { songs: [
    { id: 7, name: "测试", artists: [{ name: "原唱" }], album: { name: "专辑" }, duration: 201500 },
  ] } }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await searchSongs("测试")).toEqual([{ id: 7, title: "测试", artists: ["原唱"], album: "专辑", duration: 201.5 }]);
  expect(fetchMock.mock.calls[0][1].body.get("s")).toBe("测试");
});

it("matches the original artist and closest recording instead of another cover", () => {
  const song = { id: 1, title: "测试", artists: ["原唱"], album: "专辑", duration: 200 };
  expect(rankSongs({ title: "测试", artist: "原唱", duration: 201 }, [
    { ...song, id: 2, artists: ["翻唱"] }, { ...song, id: 3, duration: 250 }, song,
  ]).map((s: { id: number }) => s.id)).toEqual([1, 3]);
});

it("requests word timing and returns YRC without substituting line lyrics", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: 200, lrc: { lyric: "[00:01]测试" } }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await getWordLyrics(7)).toBeNull();
  const encrypted = Buffer.from(fetchMock.mock.calls[0][1].body.get("params"), "hex");
  const decipher = createDecipheriv("aes-128-ecb", "e82ckenh8dichen8", null);
  const text = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
  expect(JSON.parse(text.split("-36cd479b6b5-")[1])).toMatchObject({ id: 7, yv: -1 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("decodes a QQ word-lyric packet with the local decoder", async () => {
  const encrypted = "ee7befb746f93831d42dcdf2e21f0d5dd9fd95a45509a645c457a4c6b1f25e151e8cad1e55389e4864eb076a798a526bb2b222f5f09304642f9f1d0d6ee448ee56b3e7e489b77a349a6e8040a9518dc853dbf315ecae24540dbdca5c00c99533";
  const text = await decodeQrc(encrypted) as string;
  expect(parseLyrics(text).lines[0].words).toEqual([
    { start: 1, end: 1.25, text: "测" }, { start: 1.25, end: 1.5, text: "试" },
  ]);
});
