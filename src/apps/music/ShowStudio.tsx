import { useState } from "react";
import type { Playlist, Track } from "./model";
import { moveShowTrack, roleLabels, transitionLabels, type ActiveShow, type PlaylistShow, type ShowRole, type ShowTransition } from "./show";
import { useWorkspaceRuntime } from "../../platform/workspace/WorkspaceRuntime";

function ShowEditor({ playlist, tracks, onSave, onStart }: {
  playlist: Playlist; tracks: Track[]; onSave: (value: Playlist) => void; onStart: (value: ActiveShow) => void;
}) {
  const [ids, setIds] = useState(playlist.tracks);
  const [show, setShow] = useState<PlaylistShow>(() => playlist.show ? playlist.show : {
    title: playlist.name, transition: "continuous",
    roles: Object.fromEntries(playlist.tracks.map((id,i) => [id,i===0 ? "opening" : "main"])),
  });
  const [saved, setSaved] = useState(false);
  const { savePhoto } = useWorkspaceRuntime();
  const songs = ids.map(id => tracks.find(track=>track.id===id)!);
  const ticket = () => {
    const canvas=document.createElement("canvas");
    canvas.width=1000;canvas.height=520 + songs.length * 94;
    const ctx=canvas.getContext("2d")!;
    ctx.fillStyle="#09101e";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle="#7895b755";ctx.lineWidth=2;ctx.strokeRect(35,35,930,canvas.height-70);
    ctx.fillStyle="#a6bdd8";ctx.font="20px sans-serif";ctx.fillText("N O V A   /   A F T E R   H O U R S",75,95);
    ctx.fillStyle="#edf5ff";ctx.font="500 52px sans-serif";ctx.fillText(show.title,75,200,850);
    ctx.fillStyle="#a6bdd8";ctx.font="23px sans-serif";ctx.fillText(`${new Date().toLocaleDateString()}   ·   私人演出票根`,75,255);
    ctx.setLineDash([5,9]);ctx.beginPath();ctx.moveTo(75,315);ctx.lineTo(925,315);ctx.stroke();ctx.setLineDash([]);
    songs.forEach((song,i)=>{
      const y=382+i*94;
      ctx.fillStyle="#7693b7";ctx.font="20px sans-serif";ctx.fillText(String(i+1).padStart(2,"0"),75,y);
      ctx.fillStyle="#edf5ff";ctx.font="28px sans-serif";ctx.fillText(song.title,145,y,620);
      ctx.fillStyle="#91a8c4";ctx.font="18px sans-serif";ctx.fillText(song.artist,145,y+30,620);
      ctx.fillText(show.roles[song.id] ? roleLabels[show.roles[song.id]] : "主场",835,y);
    });
    ctx.fillStyle="#91a8c4";ctx.font="16px sans-serif";ctx.fillText("YOUR MUSIC. YOUR NIGHT.     /     ADMIT ONE",75,canvas.height-65);
    savePhoto(`${show.title} · 演出票根`,canvas.toDataURL("image/png"));
    setSaved(true);
  };
  return <section className="nm-show-editor">
    <label>演出名称<input aria-label="演出名称" value={show.title} onChange={e=>setShow({...show,title:e.target.value})} /></label>
    <label>曲目衔接<select aria-label="曲目衔接" value={show.transition} onChange={e=>setShow({...show,transition:e.target.value as ShowTransition})}>{Object.entries(transitionLabels).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
    <ol>{songs.map((song,i)=><li key={song.id}>
      <span className="nm-show-number">{String(i+1).padStart(2,"0")}</span>
      <div><strong>{song.title}</strong><small>{song.artist}</small></div>
      <select aria-label={`${song.title} 演出角色`} value={show.roles[song.id] || "main"} onChange={e=>setShow({...show,roles:{...show.roles,[song.id]:e.target.value as ShowRole}})}>{Object.entries(roleLabels).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select>
      <button aria-label={`上移 ${song.title}`} disabled={i===0} onClick={()=>setIds(moveShowTrack(ids,i,-1))}>↑</button>
      <button aria-label={`下移 ${song.title}`} disabled={i===songs.length-1} onClick={()=>setIds(moveShowTrack(ids,i,1))}>↓</button>
    </li>)}</ol>
    {!songs.length && <p>先把歌曲加入这个歌单，再开始演出。</p>}
    <div className="nm-show-actions">
      <button className="nm-primary" disabled={!songs.length} onClick={()=>onStart({...show,tracks:ids})}>开演 ▶</button>
      <button className="nm-secondary" onClick={()=>onSave({...playlist,tracks:ids,show})}>保存演出安排</button>
      <button className="nm-secondary" disabled={!songs.length} onClick={ticket}>生成桌面票根</button>
    </div>
    {saved && <p role="status">票根已保存到 NOVA 桌面。</p>}
    <p className="nm-show-note">按这里的顺序演出，开场与安可会显示专属字幕，最后一首结束后谢幕。每首歌使用已保存的舞台场景。</p>
  </section>;
}

export function ShowStudio({ playlists, tracks, onSave, onStart }: {
  playlists: Playlist[]; tracks: Track[]; onSave: (value: Playlist) => void; onStart: (value: ActiveShow) => void;
}) {
  const [selectedId,setSelectedId]=useState("");
  const playlist=playlists.find(item=>item.id===selectedId);
  return <div className="nm-show-studio"><span className="nm-eyebrow">ONE NIGHT. YOUR SETLIST.</span><h1>今晚，你来安排。</h1>
    <p>把喜欢的歌排成一场演出，留一首安可，再带走一张票根。</p>
    <label>选择歌单<select aria-label="演出歌单" value={selectedId} onChange={e=>setSelectedId(e.target.value)}><option value="">选择一个歌单</option>{playlists.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {!playlists.length && <p>在左侧“我的歌单”新建歌单，并从歌曲菜单添加歌曲。</p>}
    {playlist && <ShowEditor key={playlist.id} playlist={playlist} tracks={tracks} onSave={onSave} onStart={onStart} />}
  </div>;
}
