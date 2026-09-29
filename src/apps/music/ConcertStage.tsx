import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { activeLine, type Lyrics } from "./lyrics";
import { LyricText } from "./LyricViews";
import type { StageCamera, StagePalette } from "./performance";
import "./concert.css";

// Frequency ranges describe visual energy, not isolated instruments or beats.
export function concertLevels(data: Uint8Array, sampleRate: number, fftSize: number) {
  const band = (low: number, high: number) => {
    const start = Math.max(1, Math.floor(low * fftSize / sampleRate));
    const end = Math.min(data.length, Math.ceil(high * fftSize / sampleRate));
    let total = 0;
    for (let i = start; i < end; i++) total += data[i];
    return total / ((end - start) * 255);
  };
  return { bass: band(45, 220), air: band(1800, 8000) };
}

export function useStageAudio(root: RefObject<HTMLElement | null>, analyser: AnalyserNode | null, playing: boolean) {
  useEffect(() => {
    const element = root.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let frame = 0;
    let lastPaint = 0;
    const reset = () => {
      element.style.setProperty("--nc-bass", "0");
      element.style.setProperty("--nc-air", "0");
      element.style.setProperty("--nc-sweep", "0deg");
    };
    const tick = (now: number) => {
      if (now - lastPaint >= 32) {
        analyser!.getByteFrequencyData(data!);
        const levels = concertLevels(data!, analyser!.context.sampleRate, analyser!.fftSize);
        element.style.setProperty("--nc-bass", levels.bass.toFixed(3));
        element.style.setProperty("--nc-air", levels.air.toFixed(3));
        element.style.setProperty("--nc-sweep", `${Math.sin(now / 3200) * (8 + levels.air * 12)}deg`);
        lastPaint = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      reset();
      if (playing && analyser && !motion.matches) frame = requestAnimationFrame(tick);
    };
    update();
    motion.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", update);
      reset();
    };
  }, [analyser, playing, root]);
}

export function ConcertStage({
  analyser, playing, title, artist, lyrics, time, camera, palette,
}: {
  analyser: AnalyserNode | null;
  playing: boolean;
  title: string;
  artist: string;
  lyrics: Lyrics;
  time: number;
  camera: StageCamera;
  palette: StagePalette;
}) {
  const root = useRef<HTMLElement>(null);
  const index = activeLine(lyrics.lines, time);
  const line = lyrics.lines[index];
  const next = index >= 0 ? lyrics.lines[index + 1] : undefined;

  useStageAudio(root, analyser, playing);

  return (
    <section ref={root} className="nm-concert" data-camera={camera} data-palette={palette} data-playing={playing} aria-label="夜场演唱会">
      <header className="nm-concert-heading">
        <div><span className="nm-concert-mark">N</span><div><strong>AFTER HOURS</strong><small>NOVA 私人演唱会</small></div></div>
        <span className="nm-concert-status"><i />{playing ? "LIVE · 正在演出" : "PAUSED · 已暂停"}</span>
      </header>

      <div className="nm-concert-viewport">
        <div className="nm-concert-haze" aria-hidden="true" />
        <div className="nm-concert-world">
          <div className="nm-concert-rig" aria-hidden="true"><span /><span /><span /></div>
          <div className="nm-concert-beams" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => <i key={i} style={{
              "--beam-x": `${14 + i * 10.3}%`,
              "--beam-angle": `${(i - 3.5) * 9}deg`,
              "--beam-color": i % 2 ? "185, 160, 255" : "105, 220, 255",
            } as CSSProperties} />)}
          </div>
          <div className="nm-concert-deck" aria-hidden="true"><i /><i /><i /></div>
          <div className="nm-concert-wing left" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="nm-concert-wing right" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="nm-concert-screen">
            <div className="nm-concert-screen-orbit" aria-hidden="true" />
            <span className="nm-concert-screen-label">NOVA LIVE SESSION</span>
            <div className="nm-concert-caption">
              {line?.text ? <>
                <p className="nm-concert-lyric"><LyricText line={line} time={time} /></p>
                <p className="nm-concert-next">{next?.text}</p>
              </> : <>
                <p className="nm-concert-song-title">{title}</p>
                <p className="nm-concert-next">{artist}</p>
              </>}
            </div>
            <span className="nm-concert-screen-footer">YOUR MUSIC. YOUR STAGE.</span>
          </div>
          <div className="nm-concert-footlights" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => <i key={i} />)}
          </div>
        </div>
        <div className="nm-concert-crowd" aria-hidden="true">
          {Array.from({ length: 84 }, (_, i) => <span key={i} style={{
            "--person-x": `${(i * 37 % 101)}%`,
            "--person-depth": `${Math.floor(i / 28) * 27 + i % 7 * 2}%`,
            "--person-scale": 0.55 + Math.floor(i / 28) * 0.28,
            "--stick-angle": `${i % 2 ? -18 : 16}deg`,
            "--stick-delay": `${-i * 0.37}s`,
            "--stick-color": ["#91e7ff", "#bba1ff", "#ffaddc"][i % 3],
          } as CSSProperties}><i /></span>)}
        </div>
        <div className="nm-concert-vignette" aria-hidden="true" />
      </div>


    </section>
  );
}
