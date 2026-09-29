import { lazy, Suspense } from "react";
import { activeLine, type Lyrics } from "./lyrics";
import { LyricText } from "./LyricViews";
import { sceneLabels, type StageView } from "./performance";

const PlaceCanvas = lazy(() => import("./PlaceCanvas"));
const editions = { concert: "", train: "01 / COASTAL EXPRESS", rain: "02 / SLOW HOURS", vinyl: "03 / THE LISTENING ARCHIVE", space: "04 / LUNAR TRANSMISSION" };
const invitations = { concert: "", train: "下一站，日落。", rain: "为这一首，留一盏灯。", vinyl: "SIDE A — 33⅓ RPM", space: "来自地球的声音" };

export function ListeningRoom({ view, analyser, playing, title, artist, cover, lyrics, time }: {
  view: StageView; analyser: AnalyserNode | null; playing: boolean;
  title: string; artist: string; cover: string; lyrics: Lyrics; time: number;
}) {
  const index = activeLine(lyrics.lines, time);
  const line = lyrics.lines[index];
  const canvas = <Suspense fallback={null}><PlaceCanvas view={view} cover={view.scene === "vinyl" ? cover : ""} analyser={analyser} playing={playing} /></Suspense>;
  const places = {
    concert: null,
    train: <div className="nm-place-art nm-coastal-art" aria-hidden="true">
      <div className="nm-coastal-window">{canvas}<i className="nm-coastal-divider" /><i className="nm-coastal-glass" /></div>
      <div className="nm-coastal-seat left" /><div className="nm-coastal-seat right" />
      <div className="nm-coastal-table"><i /></div><div className="nm-coastal-ticket"><span>NOVA RAIL</span><b>只带上耳机就出发</b><i /></div>
    </div>,
    rain: <div className="nm-place-art nm-cafe-art" aria-hidden="true">
      {canvas}<div className="nm-cafe-frame" /><div className="nm-cafe-table" />
      <div className="nm-cafe-cup"><i className="nm-cafe-steam one" /><i className="nm-cafe-steam two" /><i className="nm-cafe-saucer" /><i className="nm-cafe-handle" /><i className="nm-cafe-vessel" /><i className="nm-cafe-coffee" /></div>
      <div className="nm-cafe-note">此刻，不必赶路。</div>
    </div>,
    vinyl: <div className="nm-place-art nm-archive-art" aria-hidden="true">{canvas}<div className="nm-archive-rule"><i /><span>STEREO / LONG PLAY</span></div></div>,
    space: <div className="nm-place-art nm-lunar-art" aria-hidden="true">{canvas}<div className="nm-lunar-coordinate"><i /><span>EARTH ↗<br />384,400 KM FROM HOME</span></div></div>,
  };
  return <section className="nm-room" data-scene={view.scene} data-camera={view.camera} data-palette={view.palette} data-playing={playing} aria-label={sceneLabels[view.scene]}>
    {places[view.scene]}
    <header className="nm-place-heading"><small>{editions[view.scene]}</small><span><i />{playing ? "正在聆听" : "已暂停"}</span></header>
    <div className="nm-place-caption" data-length={(line?.text || title).length > 26 ? "long" : "short"}>
      <small>{invitations[view.scene]}</small>
      <p>{line?.text ? <LyricText line={line} time={time} /> : title}</p>
      <span>{index >= 0 ? lyrics.lines[index + 1]?.text : artist}</span>
    </div>
    <footer className="nm-place-footer"><strong>{sceneLabels[view.scene]}</strong><span>{view.scene === "train" ? "把远方，听成日常。" : view.scene === "rain" ? "窗外很远，此刻很近。" : view.scene === "vinyl" ? "一张唱片，一整个下午。" : "STILL HERE, STILL LISTENING."}</span></footer>
  </section>;
}
