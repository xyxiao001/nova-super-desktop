import { useEffect, useRef, type ReactNode } from "react";
export function spectrumLevels(data: Uint8Array, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor(Math.pow(data.length, i / count));
    const end = Math.max(
      start + 1,
      Math.floor(Math.pow(data.length, (i + 1) / count)),
    );
    let value = 0;
    for (let j = start; j < Math.min(end, data.length); j++)
      value = Math.max(value, data[j]);
    return value / 255;
  });
}
export function ImmersiveStage({
  analyser,
  playing,
  cover,
  children,
  spectrumVisible,
  onSpectrumChange,
}: {
  analyser: AnalyserNode | null;
  playing: boolean;
  cover: Blob | null;
  children: ReactNode;
  spectrumVisible: boolean;
  onSpectrumChange: (visible: boolean) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = backdrop.current!;
    if (!cover) {
      element.style.removeProperty("background-image");
      return;
    }
    const url = URL.createObjectURL(cover);
    element.style.backgroundImage = `url("${url}")`;
    return () => {
      element.style.removeProperty("background-image");
      URL.revokeObjectURL(url);
    };
  }, [cover]);
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const root = stage.current!;
    const data = new Uint8Array(analyser?.frequencyBinCount ?? 128);
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const draw = (live: boolean) => {
      if (live && analyser) analyser.getByteFrequencyData(data);
      else data.fill(0);
      const levels = spectrumLevels(data, 48);
      const energy = levels.reduce((n, v) => n + v, 0) / levels.length;
      if (spectrumVisible) {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = getComputedStyle(root)
          .getPropertyValue("--nm-accent")
          .trim();
        levels.forEach((level, i) => {
          const height = 3 + level * 65;
          ctx.globalAlpha = 0.3 + level * 0.7;
          ctx.beginPath();
          ctx.roundRect(i * 12, 80 - height, 6, height, 3);
          ctx.fill();
        });
      }
      root.style.setProperty("--nm-energy", String(energy));
    };
    const tick = () => {
      draw(true);
      frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      if (playing && analyser && !motion.matches) tick();
      else if (!playing || motion.matches) draw(false);
    };
    update();
    motion.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", update);
      root.style.setProperty("--nm-energy", "0");
    };
  }, [analyser, playing, spectrumVisible]);
  return (
    <div className={`nm-immersive${spectrumVisible ? "" : " nm-spectrum-hidden"}`} ref={stage}>
      <div className="nm-cover-atmosphere" aria-hidden="true">
        <div className="nm-cover-backdrop" ref={backdrop} />
      </div>
      {children}
      <div className="nm-spectrum">
        <div>
          <span className={playing ? "nm-live-dot active" : "nm-live-dot"} />
          <small>{playing ? "正在播放" : "已暂停"}</small>
          <button
            type="button"
            className="nm-spectrum-toggle"
            aria-expanded={spectrumVisible}
            onClick={() => onSpectrumChange(!spectrumVisible)}
          >
            {spectrumVisible ? "隐藏频谱" : "显示频谱"}
          </button>
        </div>
        <canvas
          ref={canvas}
          width={576}
          height={84}
          aria-label="实时音频频谱"
          hidden={!spectrumVisible}
        />
      </div>
    </div>
  );
}
