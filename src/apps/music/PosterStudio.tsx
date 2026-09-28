import { useEffect, useRef, useState } from "react";
import type { Track } from "./model";
import type { Lyrics } from "./lyrics";
import { Icon } from "./icons";
import { useWorkspaceRuntime } from "../../platform/workspace/WorkspaceRuntime";
export function PosterStudio({
  track,
  lyrics,
  onError,
}: {
  track: Track;
  lyrics: Lyrics;
  onError: (s: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [theme, setTheme] = useState("cream");
  const [ratio, setRatio] = useState("portrait");
  const [custom, setCustom] = useState("把喜欢，留在这一刻。");
  const { savePhoto } = useWorkspaceRuntime();
  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      c.width = 1080;
      c.height = ratio === "square" ? 1080 : 1440;
      const dark = theme === "night";
      ctx.fillStyle = dark
        ? "#202026"
        : theme === "rose"
          ? "#fbe7e8"
          : "#f5f1e8";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = dark ? "#fff" : "#292526";
      ctx.font = "500 22px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("N O V A   /   M U S I C   M E M O R I E S", 80, 75);
      const side = ratio === "square" ? 380 : 570;
      const x = (1080 - side) / 2;
      if (track.cover) {
        const img = await createImageBitmap(track.cover);
        if (cancelled) {
          img.close();
          return;
        }
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, 120, side, side, 20);
        ctx.clip();
        const scale = Math.max(side / img.width, side / img.height);
        ctx.drawImage(
          img,
          x + (side - img.width * scale) / 2,
          120 + (side - img.height * scale) / 2,
          img.width * scale,
          img.height * scale,
        );
        ctx.restore();
        img.close();
      } else {
        ctx.fillStyle = "#e75e71";
        ctx.fillRect(x, 120, side, side);
        ctx.fillStyle = "white";
        ctx.font = "180px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("♫", 540, 120 + side * 0.68);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = dark ? "#fff" : "#292526";
      ctx.font = "600 44px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(track.title, 540, side + 194, 920);
      ctx.font = "26px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = dark ? "#aaaab8" : "#837777";
      ctx.fillText(track.artist, 540, side + 239, 920);
      const texts = selected.length
        ? selected.map((i) => lyrics.lines[i].text)
        : [custom];
      let y = side + 326;
      ctx.fillStyle = dark ? "#f4dfca" : "#513d3e";
      ctx.font = "500 34px -apple-system, BlinkMacSystemFont, sans-serif";
      for (const text of texts) {
        let line = "";
        for (const ch of text) {
          if (ctx.measureText(line + ch).width > 900) {
            ctx.fillText(line, 540, y);
            y += 49;
            line = "";
          }
          line += ch;
        }
        ctx.fillText(line, 540, y);
        y += 58;
      }
      ctx.strokeStyle = dark ? "#555" : "#d7ccbf";
      ctx.beginPath();
      ctx.moveTo(80, c.height - 106);
      ctx.lineTo(1000, c.height - 106);
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = dark ? "#aaa" : "#8e7b70";
      ctx.fillText("听见此刻。", 80, c.height - 60);
      ctx.textAlign = "right";
      ctx.fillText("MADE WITH NOVA", 1000, c.height - 60);
    }
    void draw().catch((e) => onError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [track, lyrics, theme, ratio, selected, custom, onError]);
  return (
    <div className="nm-poster-studio">
      <div className="nm-poster-preview">
        <canvas ref={canvas} aria-label="歌词海报预览" />
      </div>
      <div className="nm-poster-tools">
        <span className="nm-eyebrow">LYRIC POSTER</span>
        <h2>一句歌词，一份心情。</h2>
        <label>
          画布比例
          <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
            <option value="portrait">竖版 · 1080 × 1440</option>
            <option value="square">方形 · 1080 × 1080</option>
          </select>
        </label>
        <label>
          海报配色
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="cream">奶油纸张</option>
            <option value="rose">玫瑰信笺</option>
            <option value="night">午夜唱片</option>
          </select>
        </label>
        <label>
          自定义文字
          <input
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setSelected([]);
            }}
          />
        </label>
        <p>选择最多三行歌词</p>
        <div className="nm-poster-lines">
          {lyrics.lines
            .filter((l) => l.text.trim())
            .map((line) => {
              const i = lyrics.lines.indexOf(line);
              return (
                <button
                  key={i}
                  className={selected.includes(i) ? "selected" : ""}
                  onClick={() =>
                    setSelected(
                      selected.includes(i)
                        ? selected.filter((n) => n !== i)
                        : [...selected, i].slice(-3),
                    )
                  }
                >
                  {line.text}
                </button>
              );
            })}
        </div>
        <button
          className="nm-primary"
          onClick={() => {
            savePhoto(
              `${track.title} · 歌词海报`,
              canvas.current!.toDataURL("image/png"),
            );
            setSaved(true);
          }}
        >
          <Icon name="poster" />
          保存到 NOVA 桌面
        </button>
        {saved && <p role="status">已保存到桌面，可用照片打开。</p>}
      </div>
    </div>
  );
}
