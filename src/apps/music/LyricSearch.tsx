import { useEffect, useRef, useState, type FormEvent } from "react";
import { searchLrclib, type LrclibResult } from "./lrclib";
import { timeLabel } from "./model";
import { lyricTypeLabel, parseLyrics } from "./lyrics";

type SearchState =
  | { status: "idle" | "loading" }
  | { status: "success"; results: LrclibResult[] }
  | { status: "error"; message: string };

export function LyricSearch({
  title,
  artist,
  onPreview,
}: {
  title: string;
  artist: string;
  onPreview: (text: string) => void;
}) {
  const [query, setQuery] = useState(`${title} ${artist}`.trim());
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const controller = new AbortController();
    request.current = controller;
    setState({ status: "loading" });
    try {
      const results = await searchLrclib(query, controller.signal);
      setState({ status: "success", results });
    } catch (error) {
      if (!controller.signal.aborted)
        setState({ status: "error", message: (error as Error).message });
    }
  }

  return (
    <div className="nm-lyric-search">
      <form onSubmit={search}>
        <input
          type="search"
          aria-label="在线歌词搜索关键词"
          placeholder="歌名 / 歌手"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={state.status === "loading"}
        />
        <button className="nm-secondary" disabled={state.status === "loading"}>
          {state.status === "loading" ? "搜索中…" : "搜索歌词"}
        </button>
      </form>
      <small>来源 LRCLIB · 预览载入下方编辑区，点击「保存歌词」后关联。</small>
      <div aria-live="polite">
        {state.status === "error" && <p role="alert">{state.message}</p>}
        {state.status === "success" && (
          <>
            <p>
              {state.results.length
                ? `找到 ${state.results.length} 个候选`
                : "没有找到歌词"}
            </p>
            <ul className="nm-lyric-search-results" aria-label="在线歌词候选">
              {state.results.map((result) => (
                <li key={result.id}>
                  <div>
                    <strong>{result.trackName}</strong>
                    <small>
                      {result.artistName} · {result.albumName} · {timeLabel(result.duration)}
                    </small>
                  </div>
                  <div className="nm-lyric-search-actions">
                    {result.syncedLyrics && (
                      <button type="button" onClick={() => onPreview(result.syncedLyrics!)}>
                        预览{lyricTypeLabel(parseLyrics(result.syncedLyrics))}
                      </button>
                    )}
                    {result.plainLyrics && (
                      <button type="button" onClick={() => onPreview(result.plainLyrics!)}>
                        预览纯文本
                      </button>
                    )}
                    {!result.syncedLyrics && !result.plainLyrics && (
                      <small>{result.instrumental ? "纯音乐" : "无歌词文本"}</small>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
