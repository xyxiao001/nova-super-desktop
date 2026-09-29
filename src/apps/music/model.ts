import type { StageScore } from "./performance";
import type { PlaylistShow } from "./show";
export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  name: string;
  audio: Blob;
  audioHash?: string;
  cover: Blob | null;
  duration: number;
  lyrics: string;
  lyricName: string;
  added: number;
  favorite: boolean;
  source: "local" | "catalog";
  offset: number;
  performance?: StageScore;
};
export type LooseLyric = { id: string; name: string; text: string };
export type Playlist = { id: string; name: string; tracks: string[]; show?: PlaylistShow };
export type Preferences = {
  volume: number;
  mode: "order" | "repeat" | "one" | "shuffle";
  theme: "light" | "dark" | "rose";
  spectrumVisible?: boolean;
  playlists: Playlist[];
};
export const initialPreferences: Preferences = {
  volume: 0.7,
  mode: "order",
  theme: "light",
  spectrumVisible: false,
  playlists: [],
};
export type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  audio: string;
  lyrics: string;
  cover: string | null;
  bytes: number;
  audioHash: string;
};
export const timeLabel = (time: number) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
// Matching follows hzfe-music's normalized filename / artist-title candidate approach.
const normalized = (name: string) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[（(【\[].*?[）)】\]]/g, " ")
    .replace(/(?:feat|ft)\.?\s+[^-_—–]+/gi, " ")
    .replace(/[_—–·-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const compact = (name: string) =>
  normalized(name).replace(/[^\p{L}\p{N}]/gu, "");
export function lyricCandidates(
  track: Pick<Track, "name" | "title" | "artist">,
  lyrics: LooseLyric[],
) {
  const names = [
    track.name,
    track.title,
    `${track.artist} ${track.title}`,
    `${track.title} ${track.artist}`,
  ];
  const scored = lyrics.map((lyric) => {
    let score = 0;
    const target = compact(lyric.name);
    const tokens = normalized(lyric.name).split(" ");
    for (const name of names) {
      const key = compact(name);
      if (!key) continue;
      if (key === target) score = Math.max(score, 100);
      const parts = normalized(name).split(" ").filter(Boolean);
      if (parts.length > 1 && parts.every((part) => tokens.includes(part)))
        score = Math.max(score, 90);
    }
    const title = lyric.text.match(/\[ti:(.*?)\]/i)?.[1];
    const artist = lyric.text.match(/\[ar:(.*?)\]/i)?.[1];
    if (
      title &&
      compact(title) === compact(track.title) &&
      (!artist || compact(artist) === compact(track.artist))
    )
      score = Math.max(score, 100);
    return { lyric, score };
  });
  const best = Math.max(0, ...scored.map((s) => s.score));
  return best ? scored.filter((s) => s.score === best).map((s) => s.lyric) : [];
}
