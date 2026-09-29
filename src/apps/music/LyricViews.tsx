import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  activeLine,
  wordProgress,
  type Lyrics,
  type LyricLine,
} from "./lyrics";
import { Icon } from "./icons";
export function LyricText({ line, time }: { line: LyricLine; time: number }) {
  return line.words.length ? (
    line.words.map((word, i) => (
      <span
        key={i}
        className="nm-word"
        style={{ "--fill": `${wordProgress(word, time)}%` } as CSSProperties}
      >
        {word.text}
      </span>
    ))
  ) : (
    <>{line.text || "♪"}</>
  );
}
export function LyricView({
  lyrics,
  time,
  seek,
  searching = false,
}: {
  lyrics: Lyrics;
  time: number;
  seek: (value: number) => void;
  searching?: boolean;
}) {
  const index = activeLine(lyrics.lines, time);
  const container = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  useEffect(() => {
    if (follow && index >= 0) {
      const c = container.current;
      const row = c?.children[index] as HTMLElement | undefined;
      if (c && row)
        c.scrollTo({
          top:
            row.offsetTop -
            c.offsetTop -
            c.clientHeight / 2 +
            row.clientHeight / 2,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
    }
  }, [index, follow]);
  return (
    <div className="nm-lyrics-wrap">
      <div
        ref={container}
        className="nm-lyrics"
        onWheel={() => setFollow(false)}
        onTouchMove={() => setFollow(false)}
      >
        {lyrics.lines.map((line, i) => (
          <button
            key={i}
            className={index === i ? "current" : ""}
            disabled={!Number.isFinite(line.start)}
            onClick={() => seek(line.start)}
          >
            {index === i ? <LyricText line={line} time={time} /> : line.text || "♪"}
          </button>
        ))}
        {!lyrics.lines.length && (
          <div className="nm-empty" role="status">
            <Icon name="lyrics" size={40} />
            <h3>{searching ? "歌词搜索中…" : "让歌词陪你一起听"}</h3>
            <p>{searching ? "正在寻找最匹配的歌词" : "导入或关联一份歌词，即可开始同步。"}</p>
          </div>
        )}
      </div>
      {!follow && (
        <button className="nm-follow" onClick={() => setFollow(true)}>
          回到当前歌词
        </button>
      )}
    </div>
  );
}
export function FloatingLyrics({
  lyrics,
  time,
  title,
  onClose,
  toggle,
  playing,
}: {
  lyrics: Lyrics;
  time: number;
  title: string;
  onClose: () => void;
  toggle: () => void;
  playing: boolean;
}) {
  const [position, setPosition] = useState({
    x: Math.max(0, (window.innerWidth - 580) / 2),
    y: Math.max(0, window.innerHeight - 230),
  });
  const [locked, setLocked] = useState(false);
  const [size, setSize] = useState(26);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const index = activeLine(lyrics.lines, time);
  const line = lyrics.lines[index];
  return createPortal(
    <section
      className="nm-floating"
      aria-label="桌面歌词"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}

      onPointerDown={(e) => {
        e.stopPropagation();
        if (locked || (e.target as HTMLElement).closest("button,input")) return;
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          left: position.x,
          top: position.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (drag.current)
          setPosition({
            x: Math.min(
              window.innerWidth - 100,
              Math.max(0, drag.current.left + e.clientX - drag.current.x),
            ),
            y: Math.min(
              window.innerHeight - 55,
              Math.max(0, drag.current.top + e.clientY - drag.current.y),
            ),
          });
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        drag.current = null;
      }}

      style={
        {
          left: position.x,
          top: position.y,
          "--lyric-size": `${size}px`,
        } as CSSProperties
      }
    >
      <header>
        <small>{title} · 桌面歌词</small>
        <button
          aria-label={locked ? "解锁歌词位置" : "锁定歌词位置"}
          onClick={() => setLocked(!locked)}
          className={locked ? "selected" : ""}
        >
          <Icon name="lock" size={15} />
        </button>
        <input
          aria-label="桌面歌词字号"
          type="range"
          min="18"
          max="42"
          value={size}
          onChange={(e) => setSize(+e.target.value)}
        />
        <button aria-label={playing ? "暂停" : "播放"} onClick={toggle}>
          <Icon name={playing ? "pause" : "play"} size={16} />
        </button>
        <button aria-label="关闭桌面歌词" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <p>{line ? <LyricText line={line} time={time} /> : title}</p>
      <div className="nm-floating-next">{lyrics.lines[index + 1]?.text}</div>
    </section>,
    document.body,
  );
}
