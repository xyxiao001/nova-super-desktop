import DesktopWidget from "../../platform/desktop/DesktopWidget";
import MediaCardThemes from "../../platform/desktop/MediaCardThemes";
import { useWindowRuntime } from "../../platform/windows/WindowRuntime";
import { musicDesktopSession, useMusicDesktopSession } from "./musicDesktopSession";
import { Icon } from "./icons";
import { timeLabel, type Track } from "./model";
import type { Player } from "./usePlayer";
import "./musicDesktopCard.css";

export default function MusicDesktopCard({ current, coverUrl, player, message }: {
  current: Track | undefined; coverUrl: string; player: Player; message: string;
}) {
  const { openApp } = useWindowRuntime();
  const { theme } = useMusicDesktopSession();
  return <DesktopWidget title="音乐" className={`music-desktop-card music-card-${theme}`} width={320} offset={{ right: 370, top: 24 }}
    onOpen={() => openApp("music")} onUnpin={() => musicDesktopSession.update({ pinned: false })} removeTitle="移除桌面音乐卡片">
    <div className="music-card-track">
      <div className={`music-card-cover ${player.playing ? "is-playing" : ""}`}>{coverUrl ? <img src={coverUrl} alt={current?.title} /> : <Icon name="music" size={36} />}</div>
      <div><span className="music-card-eyebrow">{player.playing ? "NOW PLAYING" : "YOUR DAILY MUSIC"}</span><h2>{current ? current.title : "给此刻，一首歌。"}</h2><p>{current ? current.artist : "打开音乐，选一首喜欢的歌"}</p></div>
    </div>
    <div className="music-card-progress"><input type="range" aria-label="音乐卡片播放进度" min="0" max={player.duration || 0} step="0.1" value={player.time} disabled={!current} onChange={event => player.seek(Number(event.target.value))} /><div><span>{timeLabel(player.time)}</span><span>{timeLabel(player.duration)}</span></div></div>
    <div className="music-card-controls"><button aria-label="上一首" disabled={!current} onClick={() => player.step(-1)}><Icon name="previous" size={22} /></button><button className="music-card-play" aria-label={current ? player.playing ? "暂停音乐" : "播放音乐" : "打开音乐选歌"} onClick={current ? player.toggle : () => openApp("music")}><Icon name={player.playing ? "pause" : "play"} size={25} /></button><button aria-label="下一首" disabled={!current} onClick={() => player.step(1)}><Icon name="next" size={22} /></button></div>
    <footer><span role="status">{message || (player.playing ? "音乐正在陪伴你" : current ? "已暂停" : "等待选歌")}</span><MediaCardThemes label="音乐卡片主题" value={theme} onChange={value => musicDesktopSession.update({ theme: value })} /></footer>
  </DesktopWidget>;
}
