import { useRef, type CSSProperties } from "react";
import { activeLine, type Lyrics } from "./lyrics";
import { LyricText } from "./LyricViews";
import { useStageAudio } from "./ConcertStage";
import { sceneLabels, type StageView } from "./performance";

export function ListeningRoom({ view, analyser, playing, title, artist, cover, lyrics, time }: {
  view: StageView; analyser: AnalyserNode | null; playing: boolean;
  title: string; artist: string; cover: string; lyrics: Lyrics; time: number;
}) {
  const root = useRef<HTMLElement>(null);
  useStageAudio(root, analyser, playing);
  const index = activeLine(lyrics.lines, time);
  const line = lyrics.lines[index];
  return <section ref={root} className="nm-room" data-scene={view.scene} data-camera={view.camera} data-palette={view.palette} data-playing={playing} aria-label={sceneLabels[view.scene]}>
    <header><small>NOVA / LISTENING PLACES</small><span>{sceneLabels[view.scene]}</span></header>
    <div className="nm-room-landscape" aria-hidden="true">
      <div className="nm-room-moon" />
      <div className="nm-room-skyline">
        {Array.from({length: 22}, (_, i) => <i key={i} style={{"--building-height": `${20 + (i * 31 % 65)}%`, "--building-width": `${20 + i % 3 * 10}px`} as CSSProperties} />)}
      </div>
      <div className="nm-room-stars">{Array.from({length: 52}, (_, i) => <i key={i} style={{left:`${i * 37 % 101}%`,top:`${i * 23 % 97}%`,"--delay":`${-i * .7}s`} as CSSProperties} />)}</div>
      <div className="nm-room-rain">{Array.from({length: 32}, (_, i) => <i key={i} style={{left:`${i * 29 % 100}%`,"--delay":`${-i * .37}s`,"--duration":`${1.4 + i % 7 * .4}s`} as CSSProperties} />)}</div>
      <div className="nm-room-window" /><div className="nm-room-rail" />
      <div className="nm-room-lamp"><i /></div>
      <div className="nm-room-record"><div className="nm-room-record-disc">{cover && <img src={cover} alt="" />}</div><i className="nm-room-tonearm" /></div>
      <div className="nm-room-speaker left" /><div className="nm-room-speaker right" />
      <div className="nm-room-nebula" /><div className="nm-room-table" />
    </div>
    <div className="nm-room-caption">
      <small>{view.scene === "train" ? "NEXT STOP · 下一站，音乐" : view.scene === "vinyl" ? "SIDE A · 正在转动的时光" : "此刻，只管听歌"}</small>
      <p>{line?.text ? <LyricText line={line} time={time} /> : title}</p>
      <span>{index >= 0 ? lyrics.lines[index + 1]?.text : artist}</span>
    </div>
  </section>;
}
