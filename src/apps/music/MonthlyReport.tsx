import { useCallback, useEffect, useMemo, useState } from "react";
import {
  currentMonth,
  listeningDuration,
  readListeningHistory,
  summarizeMonth,
  type ListeningDay,
} from "./listeningHistory";
import { Icon } from "./icons";
import { useWorkspaceRuntime } from "../../platform/workspace/WorkspaceRuntime";
export function MonthlyReport({
  flush,
  onError,
}: {
  flush: () => Promise<void>;
  onError: (text: string) => void;
}) {
  const [rows, setRows] = useState<ListeningDay[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const { savePhoto } = useWorkspaceRuntime();
  const refresh = useCallback(async () => {
    await flush();
    setRows(await readListeningHistory());
    setLoaded(true);
  }, [flush]);
  useEffect(() => {
    let active = true;
    void flush()
      .then(() => readListeningHistory())
      .then((data) => {
        if (active) {
          setRows(data);
          setLoaded(true);
        }
      })
      .catch((e) => onError(e.message));
    const change = () => void refresh().catch((e) => onError(e.message));
    window.addEventListener("nova-music-history-changed", change);
    return () => {
      active = false;
      window.removeEventListener("nova-music-history-changed", change);
    };
  }, [flush, refresh, onError]);
  const report = useMemo(() => summarizeMonth(rows, month), [rows, month]);
  const [year, number] = month.split("-").map(Number);
  const days = Array.from(
    { length: new Date(year, number, 0).getDate() },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  const maximum = Math.max(1, ...report.days.values());
  const saveReport = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f8f2eb";
    ctx.fillRect(0, 0, 1080, 1440);
    ctx.fillStyle = "#df536f";
    ctx.font = "600 24px -apple-system, sans-serif";
    ctx.fillText("N O V A   /   M Y   M U S I C   M O N T H", 80, 85);
    ctx.fillStyle = "#2b2530";
    ctx.font = "700 112px -apple-system, sans-serif";
    ctx.fillText(`${String(number).padStart(2, "0")}`, 75, 238);
    ctx.font = "32px -apple-system, sans-serif";
    ctx.fillText(`/ ${year}`, 235, 230);
    ctx.font = "600 47px -apple-system, sans-serif";
    ctx.fillText("这一月，音乐一直在。", 80, 325);
    ctx.fillStyle = "#df536f";
    ctx.font = "700 74px -apple-system, sans-serif";
    ctx.fillText(listeningDuration(report.seconds), 80, 475);
    ctx.font = "26px -apple-system, sans-serif";
    ctx.fillStyle = "#867887";
    ctx.fillText(
      `听过 ${report.trackCount} 首歌  ·  ${report.activeDays} 个有音乐的日子`,
      80,
      530,
    );
    ctx.strokeStyle = "#ddd0cf";
    ctx.beginPath();
    ctx.moveTo(80, 585);
    ctx.lineTo(1000, 585);
    ctx.stroke();
    ctx.fillStyle = "#2b2530";
    ctx.font = "600 28px -apple-system, sans-serif";
    ctx.fillText("本月最常听", 80, 650);
    report.topTracks.slice(0, 3).forEach((track, i) => {
      const y = 727 + i * 102;
      ctx.fillStyle = "#df536f";
      ctx.font = "600 24px -apple-system, sans-serif";
      ctx.fillText(`0${i + 1}`, 80, y);
      ctx.fillStyle = "#2b2530";
      ctx.font = "600 30px -apple-system, sans-serif";
      ctx.fillText(track.title, 145, y, 680);
      ctx.font = "22px -apple-system, sans-serif";
      ctx.fillStyle = "#867887";
      ctx.fillText(
        `${track.artist} · ${listeningDuration(track.seconds)}`,
        145,
        y + 35,
        790,
      );
    });
    ctx.fillStyle = "#867887";
    ctx.font = "22px -apple-system, sans-serif";
    ctx.fillText("每一天的声音", 80, 1090);
    days.forEach((day, i) => {
      const height = 5 + ((report.days.get(day) ?? 0) / maximum) * 120;
      ctx.fillStyle = "#df536f";
      ctx.beginPath();
      ctx.roundRect(
        80 + (i * 920) / days.length,
        1240 - height,
        Math.max(8, 920 / days.length - 8),
        height,
        4,
      );
      ctx.fill();
    });
    ctx.font = "20px -apple-system, sans-serif";
    ctx.fillStyle = "#867887";
    ctx.fillText("仅记录真实播放时间 · 私人收藏，仅在此设备", 80, 1350);
    savePhoto(`${month} · 私人听歌月报`, canvas.toDataURL("image/png"));
    setSaved(true);
  };
  return (
    <div className="nm-month-report">
      <div className="nm-report-toolbar">
        <span className="nm-eyebrow">YOUR MONTH IN MUSIC</span>
        <label>
          选择月份
          <input
            aria-label="月报月份"
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <button
          className="nm-secondary"
          onClick={() => void refresh().catch((e) => onError(e.message))}
        >
          更新统计
        </button>
      </div>
      <div className="nm-report-hero">
        <div>
          <span className="nm-report-date">
            {String(number).padStart(2, "0")}
            <small> / {year}</small>
          </span>
          <h1>这一月，音乐一直在。</h1>
          <p>那些反复聆听的旋律，组成了你的私人时光。</p>
        </div>
        <div className="nm-report-record" aria-hidden="true">
          <Icon name="music" size={44} />
        </div>
      </div>
      {!loaded ? (
        <div className="nm-empty">正在整理你的听歌记录…</div>
      ) : !report.seconds ? (
        <div className="nm-report-empty">
          <Icon name="album" size={34} />
          <h3>这个月的故事，等你按下播放。</h3>
          <p>从现在开始记录真实听歌时长。暂停、拖动进度和缓冲不会累加时间。</p>
        </div>
      ) : (
        <>
          <div className="nm-report-stats">
            <div>
              <span>听歌时光</span>
              <strong>{listeningDuration(report.seconds)}</strong>
            </div>
            <div>
              <span>听过的歌曲</span>
              <strong>
                {report.trackCount}
                <small> 首</small>
              </strong>
            </div>
            <div>
              <span>有音乐的日子</span>
              <strong>
                {report.activeDays}
                <small> 天</small>
              </strong>
            </div>
          </div>
          <div className="nm-report-body">
            <section>
              <div className="nm-section-heading">
                <h2>本月最常听</h2>
                <small>按实际聆听时长</small>
              </div>
              <ol className="nm-report-ranking">
                {report.topTracks.slice(0, 5).map((track, i) => (
                  <li key={track.hash}>
                    <span>0{i + 1}</span>
                    <div>
                      <strong>{track.title}</strong>
                      <small>{track.artist}</small>
                      <i
                        style={{
                          width: `${(track.seconds / report.topTracks[0].seconds) * 100}%`,
                        }}
                      />
                    </div>
                    <small>{listeningDuration(track.seconds)}</small>
                  </li>
                ))}
              </ol>
              {report.topArtist && (
                <p className="nm-report-artist">
                  最常听的声音 <strong>{report.topArtist}</strong>
                </p>
              )}
            </section>
            <section>
              <div className="nm-section-heading">
                <h2>音乐日历</h2>
                <small>色彩越深，听得越久</small>
              </div>
              <div className="nm-listening-calendar">
                {days.map((day, i) => {
                  const seconds = report.days.get(day) ?? 0;
                  return (
                    <div
                      key={day}
                      title={`${day} · ${listeningDuration(seconds)}`}
                      style={{
                        background: seconds
                          ? `color-mix(in srgb, var(--nm-accent) ${15 + (seconds / maximum) * 65}%, var(--nm-bg))`
                          : undefined,
                      }}
                    >
                      <span>{i + 1}</span>
                    </div>
                  );
                })}
              </div>
              <p className="nm-muted">
                {month} · {report.activeDays} 天有音乐相伴
              </p>
            </section>
          </div>
          <button className="nm-primary" onClick={saveReport}>
            <Icon name="poster" />
            保存月报到 NOVA 桌面
          </button>
          {saved && <p role="status">月报已保存到桌面，可用照片打开。</p>}
        </>
      )}
      <p className="nm-report-privacy">
        <Icon name="lock" size={14} />
        记录只保存在此设备，可在系统设置的「私人听歌记录」中管理。
      </p>
    </div>
  );
}
