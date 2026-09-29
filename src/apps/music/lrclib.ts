import type { Track } from "./model";

export type LrclibResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  syncedLyrics: string | null;
  plainLyrics: string | null;
};

export async function searchLrclib(
  query: string,
  signal: AbortSignal,
): Promise<LrclibResult[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`https://lrclib.net/api/search?${params}`, {
    signal,
  });
  if (!response.ok) throw new Error(`LRCLIB 请求失败 (${response.status})`);
  return response.json();
}

const normalize = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function similarity(left: string, right: string) {
  const a = normalize(left), b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const pairs = (text: string) => {
    const chars = Array.from(text);
    return new Set(chars.slice(1).map((char, i) => chars[i] + char));
  };
  const aa = pairs(a), bb = pairs(b);
  const shared = [...aa].filter((pair) => bb.has(pair)).length;
  return aa.size + bb.size ? 2 * shared / (aa.size + bb.size) : 0;
}

export function bestLyricMatch(
  track: Pick<Track, "title" | "artist" | "album" | "duration">,
  results: LrclibResult[],
) {
  const ranked = results
    .filter((result) => result.syncedLyrics?.trim() || result.plainLyrics?.trim())
    .map((result) => ({
      result,
      score: [
        similarity(track.title, result.trackName),
        similarity(track.artist, result.artistName),
        track.duration > 0 && result.duration > 0
          ? 1 / (1 + Math.abs(track.duration - result.duration)) : 0,
        similarity(track.album, result.albumName),
        result.syncedLyrics?.trim() ? 1 : 0,
      ],
    }));
  // Song title is primary; metadata disambiguates covers and recordings.
  ranked.sort((a, b) => {
    for (let i = 0; i < a.score.length; i++) {
      if (a.score[i] !== b.score[i]) return b.score[i] - a.score[i];
    }
    return 0;
  });
  return ranked[0]?.result;
}

export async function findTrackLyrics(
  track: Pick<Track, "title" | "artist" | "album" | "duration">,
  signal: AbortSignal,
) {
  return bestLyricMatch(track, await searchLrclib(track.title.trim(), signal));
}
