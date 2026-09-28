"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";
import {
  initialPreferences,
  lyricCandidates,
  timeLabel,
  type CatalogTrack,
  type LooseLyric,
  type Preferences,
  type Track,
} from "./model";
import {
  readLibrary,
  removeTrack,
  saveLyrics,
  savePreferences,
  saveTracks,
} from "./storage";
import { importMusic } from "./importMusic";
import { catalogTrackInLibrary } from "./deduplication";
import { lyricExtensions, parseLyrics } from "./lyrics";
import { usePlayer } from "./usePlayer";
import { useMusicShortcuts } from "./useMusicShortcuts";
import { useWindowRuntime } from "../../platform/windows/WindowRuntime";
import { FloatingLyrics, LyricView } from "./LyricViews";
import { PosterStudio } from "./PosterStudio";
import { ImmersiveStage } from "./ImmersiveStage";
import { MonthlyReport } from "./MonthlyReport";
import "./music.css";
function useBlobUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
function Artwork({
  track,
  size = "",
}: {
  track: Pick<Track, "cover" | "title">;
  size?: string;
}) {
  const url = useBlobUrl(track.cover);
  return (
    <span className={`nm-art ${size}`}>
      {url ? (
        <img src={url} alt={`${track.title} 封面`} />
      ) : (
        <Icon name="music" size={size === "large" ? 90 : 26} />
      )}
    </span>
  );
}
type Page =
  | "library"
  | "favorites"
  | "albums"
  | "catalog"
  | "now"
  | "report"
  | "poster"
  | "lyrics"
  | `playlist:${string}`;
const modes: Preferences["mode"][] = ["order", "repeat", "one", "shuffle"];
const modeLabels = {
  order: "顺序播放",
  repeat: "列表循环",
  one: "单曲循环",
  shuffle: "随机播放",
};
export default function MusicApp() {
  const { isAppActive } = useWindowRuntime();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loose, setLoose] = useState<LooseLyric[]>([]);
  const [prefs, setPrefs] = useState(initialPreferences);
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<CatalogTrack[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [page, setPage] = useState<Page>("library");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("added");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, number>>({});
  const [floating, setFloating] = useState(false);
  const [mini, setMini] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [album, setAlbum] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const library = useRef({ tracks, loose, prefs });
  library.current = { tracks, loose, prefs };
  const controllers = useRef(new Map<string, AbortController>());
  const notify = useCallback((text: string) => setMessage(text), []);
  const player = usePlayer(tracks, prefs, notify);
  const current = tracks.find((t) => t.id === player.id);
  const ambientCoverUrl = useBlobUrl(current?.cover);
  const parsed = useMemo(
    () => parseLyrics(current?.lyrics ?? "", current?.duration),
    [current?.lyrics, current?.duration],
  );
  const lyricTime = player.time + parsed.offset + (current?.offset ?? 0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void readLibrary()
      .then((d) => {
        if (active) {
          setTracks(d.tracks);
          setLoose(d.lyrics);
          setPrefs(d.prefs);
          setReady(true);
        }
      })
      .catch((e) => notify(`曲库读取失败：${e.message}`));
    void fetch("/music/catalog.json", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<CatalogTrack[]>;
      })
      .then((d) => {
        if (active) setCatalog(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setCatalogError(`目录加载失败：${e.message}`);
      });
    return () => {
      active = false;
      controller.abort();
      for (const c of controllers.current.values()) c.abort();
    };
  }, [notify]);
  useEffect(() => {
    const reload = () => {
      player.stop();
      void readLibrary()
        .then((d) => {
          setTracks(d.tracks);
          setLoose(d.lyrics);
          setPrefs(d.prefs);
        })
        .catch((e) => notify(e.message));
    };
    window.addEventListener("nova-music-storage-changed", reload);
    return () =>
      window.removeEventListener("nova-music-storage-changed", reload);
  }, []);
  const updatePrefs = (value: Preferences) => {
    setPrefs(value);
    void savePreferences(value).catch((e) =>
      notify(`设置保存失败：${e.message}`),
    );
  };
  useMusicShortcuts(isAppActive("music") && !!current && !editId, player, prefs.volume,
    (volume) => updatePrefs({ ...prefs, volume }));
  const updateTrack = async (track: Track) => {
    await saveTracks([track]);
    setTracks((items) => items.map((t) => (t.id === track.id ? track : t)));
  };
  async function importFiles(files: File[]) {
    setBusy(true);
    try {
      const lyrics = await Promise.all(
        files
          .filter((f) => lyricExtensions.test(f.name))
          .map(async (f) => ({
            id: crypto.randomUUID(),
            name: f.name,
            text: await f.text(),
          })),
      );
      const audioFiles = files.filter((f) =>
        /\.(mp3|m4a|aac|flac|wav|ogg|opus|webm)$/i.test(f.name),
      );
      const imported: Track[] = [];
      for (const file of audioFiles) imported.push(await importMusic(file));
      const allLyrics = [...library.current.loose, ...lyrics];
      const allTracks = [...library.current.tracks, ...imported];
      let matched = 0;
      let ambiguous = 0;
      const bound = allTracks.map((t) => {
        if (t.lyrics) return t;
        const candidates = lyricCandidates(t, allLyrics);
        if (candidates.length === 1) {
          matched++;
          return {
            ...t,
            lyrics: candidates[0].text,
            lyricName: candidates[0].name,
          };
        }
        if (candidates.length > 1) ambiguous++;
        return t;
      });
      await saveLyrics(lyrics);
      const saved = await saveTracks(bound);
      setLoose(saved.lyrics);
      setTracks(saved.tracks);
      setPrefs(saved.prefs);
      notify(
        `已导入 ${imported.length - saved.mergedCount} 首音乐、${lyrics.length} 份歌词${saved.mergedCount ? `，合并 ${saved.mergedCount} 首重复音乐` : ""}，自动关联 ${matched} 首${ambiguous ? `；${ambiguous} 首有多个候选，请在歌词管理选择` : ""}`,
      );
    } catch (e) {
      notify(`导入失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  async function download(item: CatalogTrack) {
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    setDownloads((d) => ({ ...d, [item.id]: 0 }));
    try {
      const response = await fetch(item.audio, { signal: controller.signal });
      if (!response.ok) throw new Error(`音频下载失败 (${response.status})`);
      const reader = response.body!.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(new Uint8Array(value));
        received += value.length;
        setDownloads((d) => ({
          ...d,
          [item.id]: Math.min(99, Math.round((received / item.bytes) * 100)),
        }));
      }
      const lyricResponse = await fetch(item.lyrics, {
        signal: controller.signal,
      });
      if (!lyricResponse.ok)
        throw new Error(`歌词下载失败 (${lyricResponse.status})`);
      const lyrics = await lyricResponse.text();
      const track = await importMusic(
        new File(chunks, `${item.artist} - ${item.title}.mp3`, {
          type: "audio/mpeg",
        }),
        "catalog",
        item.id,
      );
      const complete = {
        ...track,
        title: item.title,
        artist: item.artist,
        album: item.album,
        lyrics,
        lyricName: `${item.title}.lrc`,
      };
      if (controller.signal.aborted) return;
      const saved = await saveTracks([complete]);
      setTracks(saved.tracks);
      setLoose(saved.lyrics);
      setPrefs(saved.prefs);
      notify(`「${item.title}」与歌词已下载，可离线播放`);
    } catch (e) {
      if (!controller.signal.aborted) notify((e as Error).message);
    } finally {
      controllers.current.delete(item.id);
      setDownloads((d) => {
        const next = { ...d };
        delete next[item.id];
        return next;
      });
    }
  }
  const selectedPlaylist = prefs.playlists.find(
    (p) => page === `playlist:${p.id}`,
  );
  const visible = useMemo(
    () =>
      tracks
        .filter(
          (t) =>
            (page !== "favorites" || t.favorite) &&
            (!selectedPlaylist || selectedPlaylist.tracks.includes(t.id)) &&
            (album === null || t.album === album) &&
            `${t.title} ${t.artist} ${t.album}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "title"
            ? a.title.localeCompare(b.title, "zh")
            : sort === "artist"
              ? a.artist.localeCompare(b.artist, "zh")
              : b.added - a.added,
        ),
    [tracks, page, selectedPlaylist, album, query, sort],
  );
  const openPage = (next: Page) => {
    setPage(next);
    setAlbum(null);
  };
  const openEditor = (t: Track) => {
    setEditId(t.id);
    setDraft(t.lyrics);
  };
  const playVisible = (id: string) =>
    void player.play(
      id,
      visible.map((t) => t.id),
    );
  const deleteSong = async (t: Track) => {
    if (player.id === t.id) player.stop();
    await removeTrack(t.id);
    setTracks((v) => v.filter((a) => a.id !== t.id));
    player.setQueue((q) => q.filter((id) => id !== t.id));
    updatePrefs({
      ...prefs,
      playlists: prefs.playlists.map((p) => ({
        ...p,
        tracks: p.tracks.filter((id) => id !== t.id),
      })),
    });
  };
  const title =
    page === "favorites"
      ? "喜欢的音乐"
      : (selectedPlaylist?.name ?? album ?? "我的音乐");
  const navigation: { page: Page; icon: IconName; label: string }[] = [
    { page: "library", icon: "music", label: "我的音乐" },
    { page: "favorites", icon: "heart", label: "喜欢的音乐" },
    { page: "albums", icon: "album", label: "专辑" },
    { page: "catalog", icon: "download", label: "发现与下载" },
    { page: "lyrics", icon: "lyrics", label: "歌词管理" },
    { page: "poster", icon: "poster", label: "歌词海报" },
    { page: "report", icon: "chart", label: "私人听歌月报" },
  ];
  return (
    <div
      className={`nova-music nm-${prefs.theme} nm-glass`}
      style={{
        "--nm-cover-image": ambientCoverUrl ? `url("${ambientCoverUrl}")` : "none",
      } as CSSProperties}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          e.stopPropagation();
          if (!busy) void importFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept="audio/*,.lrc,.txt,.srt,.vtt,.yrc,.qrc"
        onChange={(e) => {
          void importFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <aside className="nm-sidebar">
        <div className="nm-brand">
          <span>
            <Icon name="music" size={26} />
          </span>
          <strong>
            Music<small>BY NOVA</small>
          </strong>
        </div>
        <div className="nm-search">
          <Icon name="search" size={16} />
          <input
            aria-label="搜索音乐"
            placeholder="搜索歌曲、艺人、专辑"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!["library", "favorites"].includes(page) && !selectedPlaylist)
                openPage("library");
            }}
          />
        </div>
        <small className="nm-nav-label">资料库</small>
        <nav>
          {navigation.map((n, i) => (
            <button
              key={n.page}
              className={`${page === n.page ? "selected" : ""} ${i === 5 ? "nm-nav-break" : ""}`}
              onClick={() => openPage(n.page)}
            >
              <Icon name={n.icon} size={19} />
              {n.label}
              {n.page === "library" && <small>{tracks.length}</small>}
            </button>
          ))}
        </nav>
        <div className="nm-playlist-heading">
          <small className="nm-nav-label">我的歌单</small>
          <button
            aria-label="新建歌单"
            onClick={() => setShowPlaylist(!showPlaylist)}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        {showPlaylist && (
          <form
            className="nm-new-playlist"
            onSubmit={(e) => {
              e.preventDefault();
              if (playlistName.trim()) {
                const p = {
                  id: crypto.randomUUID(),
                  name: playlistName.trim(),
                  tracks: [],
                };
                updatePrefs({ ...prefs, playlists: [...prefs.playlists, p] });
                setPlaylistName("");
                setShowPlaylist(false);
                openPage(`playlist:${p.id}`);
              }
            }}
          >
            <input
              aria-label="歌单名称"
              placeholder="输入歌单名称"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
            />
            <button type="submit">创建</button>
          </form>
        )}
        <nav>
          {prefs.playlists.map((p) => (
            <button
              key={p.id}
              className={page === `playlist:${p.id}` ? "selected" : ""}
              onClick={() => openPage(`playlist:${p.id}`)}
            >
              <Icon name="queue" size={18} />
              {p.name}
            </button>
          ))}
        </nav>
        <div className="nm-sidebar-bottom">
          <div className="nm-themes">
            {(["light", "dark", "rose"] as const).map((theme, i) => (
              <button
                key={theme}
                aria-label={`切换${["浅色", "深色", "玫瑰"][i]}皮肤`}
                aria-pressed={prefs.theme === theme}
                className={`swatch-${theme} ${prefs.theme === theme ? "active" : ""}`}
                onClick={() => updatePrefs({ ...prefs, theme })}
              >
                {prefs.theme === theme && <Icon name="check" size={11} />}
              </button>
            ))}
          </div>
          <small>你的音乐，留在你的设备。</small>
        </div>
      </aside>
      <div className="nm-main">
        <header className="nm-topbar">
          <span>
            {page === "now" ? "正在播放" : "聆听你的世界"}
            <i> / </i>NOVA MUSIC
          </span>
          <button
            className="nm-secondary"
            disabled={busy || !ready}
            onClick={() => input.current?.click()}
          >
            <Icon name="plus" size={17} />
            {busy ? "正在导入…" : "导入音乐 / 歌词"}
          </button>
        </header>
        {message && (
          <div className="nm-notice" role="status">
            {message}
            <button aria-label="关闭提示" onClick={() => setMessage("")}>
              <Icon name="close" size={15} />
            </button>
          </div>
        )}
        <main
          className={`nm-content ${page === "now" ? "nm-content-now" : ""}`}
        >
          {(["library", "favorites"].includes(page) ||
            selectedPlaylist ||
            (page === "albums" && album !== null)) && (
            <>
              <div className="nm-library-hero">
                <div>
                  <span className="nm-eyebrow">YOUR PERSONAL SOUNDTRACK</span>
                  <h1>{title}</h1>
                  <p>
                    {tracks.length
                      ? `${visible.length} 首歌曲，每一首都是你的故事。`
                      : "从一首喜欢的歌开始，收藏属于你的声音。"}
                  </p>
                  <div className="nm-hero-actions">
                    <button
                      className="nm-primary"
                      disabled={!visible.length}
                      onClick={() => playVisible(visible[0].id)}
                    >
                      <Icon name="play" size={17} />
                      播放全部
                    </button>
                    <button
                      className="nm-secondary"
                      onClick={() => openPage("catalog")}
                    >
                      探索精选音乐
                    </button>
                  </div>
                </div>
                <div className="nm-hero-art">
                  {tracks[0] ? (
                    <Artwork track={tracks[0]} size="large" />
                  ) : (
                    <div className="nm-vinyl">
                      <div>
                        <Icon name="music" size={36} />
                      </div>
                    </div>
                  )}
                  <span className="nm-hero-caption">
                    A LITTLE MUSIC.
                    <br />A BETTER DAY.
                  </span>
                </div>
              </div>
              <div className="nm-section-heading">
                <h2>{selectedPlaylist ? "歌单歌曲" : "歌曲"}</h2>
                <select
                  aria-label="排序方式"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="added">最近添加</option>
                  <option value="title">歌曲名称</option>
                  <option value="artist">艺人名称</option>
                </select>
                {selectedPlaylist && (
                  <button
                    aria-label="删除歌单"
                    onClick={() => {
                      updatePrefs({
                        ...prefs,
                        playlists: prefs.playlists.filter(
                          (p) => p.id !== selectedPlaylist.id,
                        ),
                      });
                      openPage("library");
                    }}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                )}
              </div>
              <div className="nm-track-table">
                <div className="nm-table-head">
                  <span>#</span>
                  <span>歌曲 / 艺人</span>
                  <span>专辑</span>
                  <span>时长</span>
                  <span />
                </div>
                {visible.map((t, i) => (
                  <div
                    key={t.id}
                    className={`nm-track-row ${t.id === player.id ? "active" : ""}`}
                    onDoubleClick={() => playVisible(t.id)}
                  >
                    <button
                      aria-label={`播放 ${t.title}`}
                      onClick={() => playVisible(t.id)}
                    >
                      {t.id === player.id && player.playing ? (
                        <span className="nm-equalizer">
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </button>
                    <button
                      className="nm-track-title"
                      onClick={() => playVisible(t.id)}
                    >
                      <Artwork track={t} />
                      <span>
                        <strong>{t.title}</strong>
                        <small>
                          {t.artist || "未知艺人"}
                          {t.lyrics && <b>LYRICS</b>}
                        </small>
                      </span>
                    </button>
                    <span className="nm-album-cell">{t.album || "—"}</span>
                    <small>{timeLabel(t.duration)}</small>
                    <div className="nm-row-actions">
                      <button
                        aria-label={`${t.favorite ? "取消喜欢" : "喜欢"} ${t.title}`}
                        className={t.favorite ? "selected" : ""}
                        onClick={() =>
                          void updateTrack({
                            ...t,
                            favorite: !t.favorite,
                          }).catch((e) => notify(e.message))
                        }
                      >
                        <Icon name="heart" size={17} />
                      </button>
                      <details>
                        <summary aria-label={`${t.title} 更多操作`}>
                          •••
                        </summary>
                        <div className="nm-song-menu">
                          <button onClick={() => openEditor(t)}>
                            编辑 / 关联歌词
                          </button>
                          <button
                            onClick={() => player.setQueue((q) => [...q, t.id])}
                          >
                            加入播放队列
                          </button>
                          {prefs.playlists.map((p) => (
                            <button
                              key={p.id}
                              disabled={p.tracks.includes(t.id)}
                              onClick={() =>
                                updatePrefs({
                                  ...prefs,
                                  playlists: prefs.playlists.map((v) =>
                                    v.id === p.id
                                      ? { ...v, tracks: [...v.tracks, t.id] }
                                      : v,
                                  ),
                                })
                              }
                            >
                              加入「{p.name}」
                            </button>
                          ))}
                          {selectedPlaylist && (
                            <button
                              onClick={() =>
                                updatePrefs({
                                  ...prefs,
                                  playlists: prefs.playlists.map((p) =>
                                    p.id === selectedPlaylist.id
                                      ? {
                                          ...p,
                                          tracks: p.tracks.filter(
                                            (id) => id !== t.id,
                                          ),
                                        }
                                      : p,
                                  ),
                                })
                              }
                            >
                              移出此歌单
                            </button>
                          )}
                          <button
                            onClick={() =>
                              void deleteSong(t).catch((e) => notify(e.message))
                            }
                          >
                            删除本地歌曲
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                ))}
              </div>
              {!visible.length && (
                <div className="nm-empty">
                  <Icon name="music" size={40} />
                  <h3>
                    {query
                      ? "没有找到匹配的歌曲"
                      : "你的下一首心动，还在路上。"}
                  </h3>
                  <p>拖入音频与歌词，或前往「发现与下载」。</p>
                  <button
                    className="nm-secondary"
                    onClick={() => input.current?.click()}
                  >
                    选择本地文件
                  </button>
                </div>
              )}
            </>
          )}
          {page === "albums" && album === null && (
            <>
              <span className="nm-eyebrow">ALBUM COLLECTION</span>
              <h1>整张听，才完整。</h1>
              <div className="nm-album-grid">
                {[...new Set(tracks.map((t) => t.album))].map((name) => {
                  const songs = tracks.filter((t) => t.album === name);
                  return (
                    <button key={name} onClick={() => setAlbum(name)}>
                      <Artwork track={songs[0]} size="large" />
                      <h3>{name || "未归类专辑"}</h3>
                      <p>
                        {songs[0].artist} · {songs.length} 首
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {page === "catalog" && (
            <>
              <div className="nm-catalog-heading">
                <span className="nm-eyebrow">CURATED FOR YOUR MOMENTS</span>
                <h1>好音乐，值得留下。</h1>
                <p>精选音乐与原始歌词，一起下载。离线也能完整聆听。</p>
              </div>
              {catalogError && <p role="alert">{catalogError}</p>}
              <div className="nm-catalog-grid">
                {catalog.map((t, i) => {
                  const exists = catalogTrackInLibrary(t, tracks);
                  return (
                    <article key={t.id}>
                      <div className={`nm-catalog-cover palette-${i}`}>
                        {t.cover ? (
                          <img src={t.cover} alt={`${t.title} 专辑封面`} />
                        ) : (
                          <Icon name="music" size={70} />
                        )}
                        <span>0{i + 1} / SELECTED</span>
                      </div>
                      <h2>{t.title}</h2>
                      <p>
                        {t.artist} <span>· {t.album}</span>
                      </p>
                      <small>
                        音频 + {i === 2 ? "逐行" : "逐字"}歌词 ·{" "}
                        {(t.bytes / 1024 / 1024).toFixed(1)} MB
                      </small>
                      {exists ? (
                        <button
                          className="nm-secondary"
                          onClick={() =>
                            void player.play(
                              exists.id,
                              catalog.flatMap((item) => {
                                const track = catalogTrackInLibrary(
                                  item,
                                  tracks,
                                );
                                return track ? [track.id] : [];
                              }),
                            )
                          }
                        >
                          <Icon name="play" size={17} />
                          立即播放
                        </button>
                      ) : downloads[t.id] !== undefined ? (
                        <button
                          className="nm-secondary"
                          onClick={() => controllers.current.get(t.id)?.abort()}
                        >
                          下载 {downloads[t.id]}% · 取消
                        </button>
                      ) : (
                        <button
                          className="nm-primary"
                          onClick={() => void download(t)}
                        >
                          <Icon name="download" size={17} />
                          下载到资料库
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="nm-catalog-note">
                <Icon name="album" />
                <p>
                  来自你提供的音乐文件。下载后保存于此设备；在系统设置中可分别管理音乐数据与资源缓存。
                </p>
              </div>
            </>
          )}
          {page === "now" && current && (
            <ImmersiveStage
              analyser={player.analyser}
              playing={player.playing}
              cover={current.cover}
              spectrumVisible={prefs.spectrumVisible === true}
              onSpectrumChange={(spectrumVisible) =>
                updatePrefs({ ...prefs, spectrumVisible })
              }
            >
              <div className="nm-now">
                <div className="nm-now-art">
                  <span className="nm-now-eyebrow">正在聆听</span>
                  <Artwork track={current} size="large" />
                  <h1>{current.title}</h1>
                  <p>
                    {current.artist} <span>· {current.album}</span>
                  </p>
                  <div>
                    <button
                      className="nm-secondary"
                      onClick={() => openEditor(current)}
                    >
                      <Icon name="edit" size={16} />
                      编辑歌词
                    </button>
                    <label className="nm-offset">
                      歌词偏移
                      <input
                        aria-label="歌词偏移秒数"
                        type="number"
                        step="0.1"
                        value={current.offset}
                        onChange={(e) =>
                          void updateTrack({
                            ...current,
                            offset: +e.target.value,
                          }).catch((e) => notify(e.message))
                        }
                      />
                      秒
                    </label>
                  </div>
                  <small>
                    {parsed.lines.some((l) => l.words.length)
                      ? "逐字同步"
                      : parsed.timed
                        ? "逐行同步"
                        : "纯文本歌词"}{" "}
                    · 点击歌词跳转
                  </small>
                </div>
                <LyricView
                  lyrics={parsed}
                  time={lyricTime}
                  seek={(t) =>
                    player.seek(Math.max(0, t - parsed.offset - current.offset))
                  }
                />
              </div>
            </ImmersiveStage>
          )}
          {page === "report" && (
            <MonthlyReport flush={player.flushListening} onError={notify} />
          )}
          {(page === "now" || page === "poster") && !current && (
            <div className="nm-empty">
              <Icon name={page === "poster" ? "poster" : "lyrics"} size={50} />
              <h2>先选一首歌吧。</h2>
              <p>播放歌曲后，即可查看歌词、制作海报。</p>
              <button
                className="nm-primary"
                onClick={() => openPage("library")}
              >
                前往资料库
              </button>
            </div>
          )}
          {page === "poster" && current && (
            <PosterStudio
              key={current.id}
              track={current}
              lyrics={parsed}
              onError={notify}
            />
          )}
          {page === "lyrics" && (
            <>
              <span className="nm-eyebrow">WORDS THAT STAY</span>
              <h1>每一句，都有回响。</h1>
              <p className="nm-muted">
                支持 LRC 逐行 / 逐字、Enhanced LRC、TXT、SRT、WebVTT、明文 YRC /
                QRC。拖入歌词后自动匹配，重名候选手动关联。
              </p>
              <div className="nm-lyric-management">
                {tracks.map((t) => (
                  <button key={t.id} onClick={() => openEditor(t)}>
                    <Artwork track={t} />
                    <span>
                      <strong>{t.title}</strong>
                      <small>
                        {t.lyrics
                          ? `${t.lyricName || "内嵌 / 编辑歌词"} · ${parseLyrics(t.lyrics).lines.length} 行`
                          : "尚未关联歌词"}
                      </small>
                    </span>
                    <Icon name="edit" size={18} />
                  </button>
                ))}
              </div>
              <h3>已导入歌词文件 · {loose.length}</h3>
              {loose.map((l) => (
                <p className="nm-muted" key={l.id}>
                  {l.name}
                </p>
              ))}
            </>
          )}
        </main>
      </div>
      <footer className="nm-player">
        <button
          className="nm-playing-track"
          disabled={!current}
          onClick={() => openPage("now")}
        >
          {current ? (
            <Artwork track={current} />
          ) : (
            <span className="nm-art">
              <Icon name="music" />
            </span>
          )}
          <span>
            <strong>{current?.title ?? "音乐，让此刻不同"}</strong>
            <small>{current?.artist ?? "选择一首歌曲开始聆听"}</small>
          </span>
        </button>
        <div className="nm-player-center">
          <div className="nm-playback-buttons">
            <button
              aria-label={modeLabels[prefs.mode]}
              title={modeLabels[prefs.mode]}
              onClick={() =>
                updatePrefs({
                  ...prefs,
                  mode: modes[(modes.indexOf(prefs.mode) + 1) % 4],
                })
              }
            >
              <Icon
                name={prefs.mode === "shuffle" ? "shuffle" : "repeat"}
                size={17}
              />
              {prefs.mode === "one" && <sup>1</sup>}
              {prefs.mode === "order" && <sup>→</sup>}
            </button>
            <button
              aria-label="上一首"
              disabled={!current}
              onClick={() => player.step(-1)}
            >
              <Icon name="previous" />
            </button>
            <button
              className="nm-play-button"
              aria-label={player.playing ? "暂停" : "播放"}
              aria-keyshortcuts="Space"
              title="播放 / 暂停（空格）；← → 跳转 5 秒；↑ ↓ 调整音量"
              disabled={!current}
              onClick={player.toggle}
            >
              <Icon name={player.playing ? "pause" : "play"} size={23} />
            </button>
            <button
              aria-label="下一首"
              disabled={!current}
              onClick={() => player.step(1)}
            >
              <Icon name="next" />
            </button>
            <button
              aria-label="显示播放队列"
              className={queueOpen ? "selected" : ""}
              onClick={() => setQueueOpen(!queueOpen)}
            >
              <Icon name="queue" size={18} />
            </button>
          </div>
          <div className="nm-seek">
            <span>{timeLabel(player.time)}</span>
            <input
              aria-label="播放进度"
              type="range"
              min="0"
              max={player.duration || 0}
              step="0.01"
              value={player.time}
              disabled={!current}
              onChange={(e) => player.seek(+e.target.value)}
            />
            <span>{timeLabel(player.duration)}</span>
          </div>
        </div>
        <div className="nm-player-right">
          <button
            aria-label="打开桌面歌词"
            disabled={!current}
            className={floating ? "selected" : ""}
            onClick={() => setFloating(!floating)}
          >
            <Icon name="lyrics" />
          </button>
          <button
            aria-label="迷你播放器"
            disabled={!current}
            onClick={() => setMini(!mini)}
          >
            <Icon name="window" />
          </button>
          <Icon name="volume" size={18} />
          <input
            aria-label="音量"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={prefs.volume}
            onChange={(e) => updatePrefs({ ...prefs, volume: +e.target.value })}
          />
        </div>
      </footer>
      {queueOpen && (
        <aside className="nm-queue">
          <header>
            <h3>接下来播放</h3>
            <button aria-label="关闭队列" onClick={() => setQueueOpen(false)}>
              <Icon name="close" />
            </button>
          </header>
          {player.queue.map((id, i) => {
            const t = tracks.find((t) => t.id === id);
            return (
              t && (
                <div
                  key={`${id}-${i}`}
                  className={id === player.id ? "selected" : ""}
                >
                  <button onClick={() => void player.play(id)}>
                    {t.title}
                    <small>{t.artist}</small>
                  </button>
                  <button
                    aria-label={`从队列移除 ${t.title}`}
                    onClick={() =>
                      player.setQueue((q) => q.filter((_, n) => n !== i))
                    }
                  >
                    <Icon name="close" size={15} />
                  </button>
                </div>
              )
            );
          })}
        </aside>
      )}
      {floating && current && (
        <FloatingLyrics
          lyrics={parsed}
          time={lyricTime}
          title={current.title}
          onClose={() => setFloating(false)}
          toggle={player.toggle}
          playing={player.playing}
        />
      )}
      {mini &&
        current &&
        createPortal(
          <div className={`nm-mini nm-${prefs.theme}`}>
            <Artwork track={current} />
            <button onClick={() => openPage("now")}>
              <strong>{current.title}</strong>
              <small>{current.artist}</small>
            </button>
            <button
              aria-label={player.playing ? "暂停" : "播放"}
              onClick={player.toggle}
            >
              <Icon name={player.playing ? "pause" : "play"} />
            </button>
            <button aria-label="下一首" onClick={() => player.step(1)}>
              <Icon name="next" />
            </button>
            <button aria-label="关闭迷你播放器" onClick={() => setMini(false)}>
              <Icon name="close" size={16} />
            </button>
          </div>,
          document.body,
        )}
      {editId && (
        <div className="nm-modal-backdrop">
          <section
            className="nm-editor"
            role="dialog"
            aria-modal="true"
            aria-label="歌词编辑与关联"
          >
            <header>
              <h2>{tracks.find((t) => t.id === editId)?.title} · 歌词</h2>
              <button aria-label="关闭歌词编辑" onClick={() => setEditId(null)}>
                <Icon name="close" />
              </button>
            </header>
            <label>
              关联已导入的歌词
              <select
                aria-label="关联歌词文件"
                value=""
                onChange={(e) => {
                  const l = loose.find((l) => l.id === e.target.value);
                  if (l) setDraft(l.text);
                }}
              >
                <option value="">选择歌词文件</option>
                {loose.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              aria-label="歌词源文本"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="nm-editor-footer">
              <small>
                {parseLyrics(draft).lines.length} 行 ·
                保留原始时间戳，无长度截断
              </small>
              <button
                className="nm-secondary"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([draft], { type: "text/plain;charset=utf-8" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${tracks.find((t) => t.id === editId)?.title}.lrc`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                导出歌词
              </button>
              <button
                className="nm-primary"
                onClick={() => {
                  const t = tracks.find((t) => t.id === editId)!;
                  void updateTrack({
                    ...t,
                    lyrics: draft,
                    lyricName:
                      loose.find((l) => l.text === draft)?.name ?? "编辑的歌词",
                  })
                    .then(() => {
                      setEditId(null);
                      notify("歌词已保存并关联");
                    })
                    .catch((e) => notify(e.message));
                }}
              >
                保存歌词
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
