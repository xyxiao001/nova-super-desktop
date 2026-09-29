import type { Lyrics } from "./lyrics";
import { ConcertStage } from "./ConcertStage";
import { ListeningRoom } from "./ListeningRoom";
import { sceneLabels, type StageScore, type StageView } from "./performance";
import type { Track } from "./model";
import "./listening.css";
import { soundLabels, type SoundPreset } from "./listeningEffects";
import { roleLabels, type ActiveShow } from "./show";

const cameras = [{ id: "front", label: "前排" }, { id: "stands", label: "看台" }, { id: "wide", label: "全景" }] as const;

export function ListeningStudio({ score, onChange, onSave, track, cover, lyrics, time, songTime, analyser, playing, sound, onSoundChange, rainVolume, onRainChange, show, showFinished, onStopShow }: {
  score: StageScore; onChange: (score: StageScore) => void; onSave: () => void;
  track: Track; cover: string; lyrics: Lyrics; time: number; songTime: number;
  analyser: AnalyserNode | null; playing: boolean;
  sound: SoundPreset; onSoundChange: (value: SoundPreset) => void;
  rainVolume: number; onRainChange: (value: number) => void;
  show: ActiveShow | null; showFinished: boolean; onStopShow: () => void;
}) {
  const { view } = score;
  const changeView = (patch: Partial<StageView>) => onChange({ view: { ...view, ...patch } });

  return <div className="nm-listening-studio">
    <div className="nm-studio-toolbar">
      <select aria-label="听歌地点" value={view.scene} onChange={(e) => changeView({ scene: e.target.value as StageView["scene"] })}>
        {Object.entries(sceneLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <div className="nm-studio-cameras" role="group" aria-label="舞台机位">
        {cameras.map((camera) => <button key={camera.id} aria-pressed={view.camera === camera.id} onClick={() => changeView({ camera: camera.id })}>{camera.label}</button>)}
      </div>
      <details className="nm-studio-settings">
        <summary>氛围设置</summary>
        <div className="nm-studio-settings-panel">
          <header><strong>让此刻更合心意</strong><small>灯色与声音</small></header>
          <label>灯色<select aria-label="舞台灯色" value={view.palette} onChange={(e) => changeView({ palette: e.target.value as StageView["palette"] })}>
            <option value="ice">冰蓝</option><option value="violet">紫夜</option><option value="rose">玫瑰</option>
          </select></label>
          <label>声音空间<select aria-label="声音空间" value={sound} onChange={(e) => onSoundChange(e.target.value as SoundPreset)}>{Object.entries(soundLabels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="nm-studio-rain">雨声<input type="range" aria-label="雨声音量" min="0" max="1" step="0.01" value={rainVolume} onChange={(e) => onRainChange(+e.target.value)} /><span>{Math.round(rainVolume * 100)}%</span></label>
          <div className="nm-studio-settings-actions"><button onClick={() => { onSoundChange("original"); onRainChange(0); }}>恢复原声</button><button onClick={onSave}>保存当前场景</button></div>
          <p>场景随歌曲保存和分享，声音设置仅在本次聆听生效。</p>
        </div>
      </details>
    </div>
    <div className="nm-studio-screen">
      {view.scene === "concert" ? <ConcertStage analyser={analyser} playing={playing} title={track.title} artist={track.artist} lyrics={lyrics} time={time} camera={view.camera} palette={view.palette} />
        : <ListeningRoom view={view} analyser={analyser} playing={playing} title={track.title} artist={track.artist} cover={cover} lyrics={lyrics} time={time} />}
      {show && (showFinished || songTime < 4) && <div className="nm-show-titlecard">
        <small>{showFinished ? "THANK YOU FOR LISTENING" : show.roles[track.id] ? roleLabels[show.roles[track.id]] : "主场"}</small>
        <h2>{show.title}</h2><p>{showFinished ? "今晚的最后一个音符，留给你。" : track.title}</p>
      </div>}
    </div>
    {show && <div className="nm-show-running"><span>{show.title} · {show.tracks.indexOf(track.id)+1} / {show.tracks.length}</span><button onClick={onStopShow}>结束演出模式</button></div>}
  </div>;
}
