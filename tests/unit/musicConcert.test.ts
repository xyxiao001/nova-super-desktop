import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConcertStage, concertLevels } from "../../src/apps/music/ConcertStage";
import { parseLyrics } from "../../src/apps/music/lyrics";

describe("concert audio lighting", () => {
  it("keeps silence dark and responds independently to low and high frequencies", () => {
    const bins = new Uint8Array(128);
    expect(concertLevels(bins, 48000, 256)).toEqual({ bass: 0, air: 0 });
    bins[1] = 255; // 187.5 Hz
    expect(concertLevels(bins, 48000, 256)).toEqual({ bass: 1, air: 0 });
    bins.fill(0);
    bins.fill(255, 9, 43); // 1.8–8 kHz band at this FFT resolution
    expect(concertLevels(bins, 48000, 256)).toEqual({ bass: 0, air: 1 });
  });

  it("maps frequencies using the audio context sample rate", () => {
    const bins = new Uint8Array(1024);
    bins[8] = 128; // 172 Hz with a 44.1 kHz context and 2048 FFT
    const { bass, air } = concertLevels(bins, 44100, 2048);
    expect(bass).toBeGreaterThan(0);
    expect(air).toBe(0);
  });
});

const lyrics = parseLyrics("[5000,4000](5000,2000,0)第一(7000,2000,0)句\n[00:12.00]下一句", 20);
const render = (time: number, playing = true, source = lyrics) => renderToStaticMarkup(createElement(ConcertStage, {
  analyser: null, playing, title: "测试夜场", artist: "NOVA", lyrics: source, time,
  camera: "stands", palette: "ice",
}));

describe("concert lyric screen", () => {
  it("shows the track before vocals and does not invent timed words for untimed text", () => {
    expect(render(0)).toContain('class="nm-concert-song-title">测试夜场');
    expect(render(0)).not.toContain('class="nm-word"');
    expect(render(6, true, parseLyrics("一份纯文本歌词"))).not.toContain('class="nm-word"');
  });

  it("uses existing word progress and updates the screen after seeking", () => {
    const singing = render(6);
    expect(singing).toContain('style="--fill:50%"');
    expect(singing).toContain('class="nm-concert-next">下一句');
    const interlude = render(10);
    expect(interlude).toContain('class="nm-concert-song-title">测试夜场');
    expect(interlude).not.toContain('class="nm-word"');
    expect(render(13)).toContain('class="nm-concert-lyric">下一句');
  });

  it("keeps the paused lyric position and selected camera", () => {
    const paused = render(6, false);
    expect(paused).toContain('data-playing="false"');
    expect(paused).toContain('style="--fill:50%"');
    expect(paused).toContain('data-camera="stands"');
  });
});
