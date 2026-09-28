import type { CatalogTrack, LooseLyric, Preferences, Track } from "./model";
export async function audioFingerprint(audio: Blob) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await audio.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function mergeDuplicateTracks(tracks: Track[], prefs: Preferences) {
  const groups = new Map<string, Track>();
  const aliases = new Map<string, string>();
  const extraLyrics: LooseLyric[] = [];
  // Keep the oldest library identity so existing references remain stable.
  for (const track of [...tracks].sort(
    (a, b) => a.added - b.added || a.id.localeCompare(b.id),
  )) {
    const original = groups.get(track.audioHash!);
    if (!original) {
      groups.set(track.audioHash!, track);
      continue;
    }
    aliases.set(track.id, original.id);
    if (original.lyrics && track.lyrics && original.lyrics !== track.lyrics) {
      extraLyrics.push({
        id: `merged-${track.id}`,
        name: track.lyricName || `${track.title}.lrc`,
        text: track.lyrics,
      });
    }
    groups.set(track.audioHash!, {
      ...original,
      favorite: original.favorite || track.favorite,
      cover: original.cover ?? track.cover,
      ...(!original.lyrics && track.lyrics
        ? {
            lyrics: track.lyrics,
            lyricName: track.lyricName,
            offset: track.offset,
          }
        : {}),
    });
  }
  return {
    tracks: [...groups.values()],
    aliases,
    extraLyrics,
    prefs: aliases.size
      ? {
          ...prefs,
          playlists: prefs.playlists.map((p) => ({
            ...p,
            tracks: [...new Set(p.tracks.map((id) => aliases.get(id) ?? id))],
          })),
        }
      : prefs,
  };
}
export const catalogTrackInLibrary = (item: CatalogTrack, tracks: Track[]) =>
  tracks.find((track) => track.audioHash === item.audioHash);
