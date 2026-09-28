import { openDB } from "idb";
export type ListeningTrack = { hash: string; title: string; artist: string };
export type ListeningDay = ListeningTrack & {
  id: string;
  day: string;
  seconds: number;
};
export const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const currentMonth = () => localDay(new Date()).slice(0, 7);
export function splitListeningTime(
  track: ListeningTrack,
  start: number,
  end: number,
  seconds: number,
): ListeningDay[] {
  const rows: ListeningDay[] = [];
  for (let cursor = start; cursor < end;) {
    const date = new Date(cursor);
    const day = localDay(date);
    const midnight = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1,
    ).getTime();
    const until = Math.min(end, midnight);
    rows.push({
      ...track,
      id: `${day}:${track.hash}`,
      day,
      seconds: (seconds * (until - cursor)) / (end - start),
    });
    cursor = until;
  }
  return rows;
}
// Sample only while the media is advancing. Seeking resets the baseline.
export class ListeningMeter {
  private previous: { wall: number; media: number } | null = null;
  reset(wall: number, media: number) {
    this.previous = { wall, media };
  }
  sample(track: ListeningTrack, wall: number, media: number) {
    const previous = this.previous;
    this.reset(wall, media);
    if (!previous) return [];
    const seconds = Math.min(
      (wall - previous.wall) / 1000,
      media - previous.media,
    );
    return seconds > 0
      ? splitListeningTime(track, previous.wall, wall, seconds)
      : [];
  }
}
const historyDB = () =>
  openDB("nova-music-history", 1, {
    upgrade(db) {
      db.createObjectStore("days", { keyPath: "id" });
    },
  });
export async function addListeningTime(rows: ListeningDay[]) {
  if (!rows.length) return;
  const db = await historyDB();
  const tx = db.transaction("days", "readwrite");
  for (const row of rows) {
    const saved = (await tx.store.get(row.id)) as ListeningDay | undefined;
    await tx.store.put({
      ...row,
      seconds: row.seconds + (saved?.seconds ?? 0),
    });
  }
  await tx.done;
  db.close();
}
export async function readListeningHistory(): Promise<ListeningDay[]> {
  const db = await historyDB();
  const rows = await db.getAll("days");
  db.close();
  return rows;
}
export async function replaceListeningHistory(rows: ListeningDay[]) {
  const db = await historyDB();
  const tx = db.transaction("days", "readwrite");
  await tx.store.clear();
  for (const row of rows) tx.store.put(row);
  await tx.done;
  db.close();
}
export function summarizeMonth(rows: ListeningDay[], month: string) {
  const selected = rows.filter((row) => row.day.startsWith(`${month}-`));
  const tracks = new Map<string, ListeningTrack & { seconds: number }>();
  const days = new Map<string, number>();
  const artists = new Map<string, number>();
  for (const row of selected) {
    const track = tracks.get(row.hash);
    tracks.set(row.hash, {
      hash: row.hash,
      title: row.title,
      artist: row.artist,
      seconds: row.seconds + (track?.seconds ?? 0),
    });
    days.set(row.day, (days.get(row.day) ?? 0) + row.seconds);
    if (row.artist)
      artists.set(row.artist, (artists.get(row.artist) ?? 0) + row.seconds);
  }
  return {
    seconds: selected.reduce((sum, row) => sum + row.seconds, 0),
    trackCount: tracks.size,
    activeDays: days.size,
    days,
    topTracks: [...tracks.values()].sort((a, b) => b.seconds - a.seconds),
    topArtist: [...artists].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
  };
}
export const listeningDuration = (seconds: number) =>
  seconds < 60
    ? `${Math.floor(seconds)} 秒`
    : `${Math.floor(seconds / 60)} 分钟`;
