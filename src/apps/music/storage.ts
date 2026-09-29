import { openDB, type DBSchema } from "idb";
import {
  initialPreferences,
  type Track,
  type Preferences,
  type LooseLyric,
  type PlaybackBookmark,
} from "./model";
import { audioFingerprint, mergeDuplicateTracks } from "./deduplication";
type MusicLibrary = {
  tracks: Track[];
  lyrics: LooseLyric[];
  prefs: Preferences;
  playback?: PlaybackBookmark;
};
interface MusicDB extends DBSchema {
  tracks: { key: string; value: Track };
  lyrics: { key: string; value: LooseLyric };
  settings: { key: string; value: Preferences | PlaybackBookmark };
}
const db = () =>
  openDB<MusicDB>("nova-music", 1, {
    upgrade(d) {
      d.createObjectStore("tracks", { keyPath: "id" });
      d.createObjectStore("lyrics", { keyPath: "id" });
      d.createObjectStore("settings");
    },
  });
export async function readLibrary(): Promise<MusicLibrary> {
  return saveTracks([]);
}
export async function saveTracks(incoming: Track[]) {
  const d = await db();
  // Hash blobs before starting a write transaction: digest awaits must not close it.
  const existing = await d.getAll("tracks");
  const hashes = new Map(
    await Promise.all(
      existing.map(
        async (track) =>
          [
            track.id,
            track.audioHash ?? (await audioFingerprint(track.audio)),
          ] as const,
      ),
    ),
  );
  const prepared = await Promise.all(
    incoming.map(async (track) => ({
      ...track,
      audioHash: track.audioHash ?? (await audioFingerprint(track.audio)),
    })),
  );
  const tx = d.transaction(["tracks", "settings", "lyrics"], "readwrite");
  const stored = await tx.objectStore("tracks").getAll();
  const prefs =
    (await tx.objectStore("settings").get("preferences") as Preferences | undefined) ?? initialPreferences;
  let playback = await tx.objectStore("settings").get("playback") as PlaybackBookmark | undefined;
  const combined = new Map(
    stored.map((track) => [
      track.id,
      { ...track, audioHash: track.audioHash ?? hashes.get(track.id)! },
    ]),
  );
  for (const track of prepared) combined.set(track.id, track);
  const merged = mergeDuplicateTracks([...combined.values()], prefs);
  if (
    incoming.length ||
    merged.aliases.size ||
    stored.some((track) => !track.audioHash)
  ) {
    for (const track of merged.tracks) tx.objectStore("tracks").put(track);
    for (const id of merged.aliases.keys()) tx.objectStore("tracks").delete(id);
    if (merged.aliases.size)
      tx.objectStore("settings").put(merged.prefs, "preferences");
    for (const lyric of merged.extraLyrics) tx.objectStore("lyrics").put(lyric);
  }
  const lyrics = await tx.objectStore("lyrics").getAll();
  if (playback && merged.aliases.size) {
    playback = {
      ...playback,
      trackId: merged.aliases.get(playback.trackId) ?? playback.trackId,
      queue: [...new Set(playback.queue.map((id) => merged.aliases.get(id) ?? id))],
    };
    tx.objectStore("settings").put(playback, "playback");
  }
  await tx.done;
  d.close();
  return {
    tracks: merged.tracks,
    lyrics,
    prefs: merged.prefs,
    playback,
    mergedCount: merged.aliases.size,
  };
}
export async function saveLyrics(lyrics: LooseLyric[]) {
  const d = await db();
  const tx = d.transaction("lyrics", "readwrite");
  for (const l of lyrics) tx.store.put(l);
  await tx.done;
  d.close();
}
export async function savePreferences(prefs: Preferences) {
  const d = await db();
  await d.put("settings", prefs, "preferences");
  d.close();
}
export async function removeTrack(id: string) {
  const d = await db();
  const tx = d.transaction(["tracks", "settings"], "readwrite");
  await tx.objectStore("tracks").delete(id);
  let playback = await tx.objectStore("settings").get("playback") as PlaybackBookmark | undefined;
  if (playback?.trackId === id) {
    playback = undefined;
    await tx.objectStore("settings").delete("playback");
  } else if (playback) {
    playback = { ...playback, queue: playback.queue.filter((trackId) => trackId !== id) };
    await tx.objectStore("settings").put(playback, "playback");
  }
  await tx.done;
  d.close();
  return playback;
}
export async function savePlayback(playback: PlaybackBookmark) {
  const d = await db();
  await d.put("settings", playback, "playback");
  d.close();
}
export async function replaceLibrary(
  value: Awaited<ReturnType<typeof readLibrary>>,
) {
  const d = await db();
  const tx = d.transaction(["tracks", "lyrics", "settings"], "readwrite");
  for (const name of ["tracks", "lyrics", "settings"] as const)
    await tx.objectStore(name).clear();
  for (const t of value.tracks) tx.objectStore("tracks").put(t);
  for (const l of value.lyrics) tx.objectStore("lyrics").put(l);
  tx.objectStore("settings").put(value.prefs, "preferences");
  if (value.playback) tx.objectStore("settings").put(value.playback, "playback");
  await tx.done;
  d.close();
}
