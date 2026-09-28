import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  ListeningMeter,
  splitListeningTime,
  summarizeMonth,
  localDay,
  addListeningTime,
  readListeningHistory,
  replaceListeningHistory,
} from "../../src/apps/music/listeningHistory";
import { spectrumLevels } from "../../src/apps/music/ImmersiveStage";
const track = { hash: "audio-sha", title: "刚刚好", artist: "薛之谦" };
describe("actual listening time", () => {
  it("counts media advancement, but not a stalled media clock", () => {
    const meter = new ListeningMeter();
    meter.reset(1000, 20);
    expect(meter.sample(track, 2000, 21)[0].seconds).toBe(1);
    expect(meter.sample(track, 4000, 21)).toEqual([]);
    expect(meter.sample(track, 4500, 21.5)[0].seconds).toBe(0.5);
  });
  it("excludes seek jumps and pause intervals by resetting the baseline", () => {
    const meter = new ListeningMeter();
    meter.reset(0, 0);
    expect(meter.sample(track, 1000, 1)[0].seconds).toBe(1);
    meter.reset(2000, 180);
    expect(meter.sample(track, 3000, 181)[0].seconds).toBe(1);
    meter.reset(30000, 181);
    expect(meter.sample(track, 31000, 182)[0].seconds).toBe(1);
  });
  it("does not inflate time when the audio timeline advances faster than wall time", () => {
    const meter = new ListeningMeter();
    meter.reset(1000, 0);
    expect(meter.sample(track, 2000, 2)[0].seconds).toBe(1);
  });
  it("splits listening across local midnight and month boundary", () => {
    const start = new Date(2026, 8, 30, 23, 59, 59).getTime();
    const rows = splitListeningTime(track, start, start + 2000, 2);
    expect(rows.map((r) => [r.day, r.seconds])).toEqual([
      ["2026-09-30", 1],
      ["2026-10-01", 1],
    ]);
    expect(summarizeMonth(rows, "2026-09").seconds).toBe(1);
    expect(summarizeMonth(rows, "2026-10").seconds).toBe(1);
  });
  it("aggregates repeat listening by audio identity and ranks the real totals", () => {
    const rows = [
      ...splitListeningTime(
        track,
        new Date(2026, 8, 1).getTime(),
        new Date(2026, 8, 1).getTime() + 90000,
        90,
      ),
      ...splitListeningTime(
        track,
        new Date(2026, 8, 2).getTime(),
        new Date(2026, 8, 2).getTime() + 30000,
        30,
      ),
      ...splitListeningTime(
        { ...track, hash: "other", title: "崇拜" },
        new Date(2026, 8, 2).getTime(),
        new Date(2026, 8, 2).getTime() + 40000,
        40,
      ),
    ];
    const summary = summarizeMonth(rows, "2026-09");
    expect(summary.seconds).toBe(160);
    expect(summary.trackCount).toBe(2);
    expect(summary.activeDays).toBe(2);
    expect(summary.topTracks[0].seconds).toBe(120);
    expect(summary.topArtist).toBe("薛之谦");
    expect(summarizeMonth(rows, "2026-08").seconds).toBe(0);
  });
});
describe("local listening storage", () => {
  beforeEach(() => replaceListeningHistory([]));
  it("persists and adds simultaneous listening segments without overwriting", async () => {
    const day = localDay(new Date());
    const row = { ...track, day, id: `${day}:${track.hash}`, seconds: 3 };
    await Promise.all([
      addListeningTime([row]),
      addListeningTime([{ ...row, seconds: 7 }]),
    ]);
    const rows = await readListeningHistory();
    expect(rows).toHaveLength(1);
    expect(rows[0].seconds).toBe(10);
    await replaceListeningHistory([]);
    expect(await readListeningHistory()).toEqual([]);
  });
});
describe("real audio spectrum", () => {
  it("renders silence as zero and frequency energy from analyser bins", () => {
    expect(spectrumLevels(new Uint8Array(128), 48).every((v) => v === 0)).toBe(
      true,
    );
    const bins = new Uint8Array(128);
    bins[32] = 255;
    const levels = spectrumLevels(bins, 48);
    expect(levels.some((v) => v === 1)).toBe(true);
    expect(levels.filter((v) => v > 0).length).toBeLessThan(5);
  });
});
