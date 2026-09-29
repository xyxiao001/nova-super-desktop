import type { StorageProvider } from "../../platform/storage/providers/types";
import { readLibrary, replaceLibrary } from "./storage";
import { initialPreferences, type Track } from "./model";
const encode = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { type: blob.type, data: btoa(binary) };
};
const decode = (value: { type: string; data: string }) =>
  new Blob([Uint8Array.from(atob(value.data), (c) => c.charCodeAt(0))], {
    type: value.type,
  });
async function exportMusic() {
  const data = await readLibrary();
  return {
    ...data,
    tracks: await Promise.all(
      data.tracks.map(async (t) => ({
        ...t,
        audio: await encode(t.audio),
        cover: t.cover ? await encode(t.cover) : null,
      })),
    ),
  };
}
type Backup = Awaited<ReturnType<typeof exportMusic>>;
const validate = (v: unknown): v is Backup => {
  const b = v as Backup;
  return (
    !!b &&
    Array.isArray(b.tracks) &&
    Array.isArray(b.lyrics) &&
    !!b.prefs &&
    b.tracks.every(
      (t) =>
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        typeof t.audio?.data === "string" &&
        typeof t.audio.type === "string" &&
        (t.cover === null ||
          (typeof t.cover?.data === "string" &&
            typeof t.cover.type === "string")),
    )
  );
};
const provider: StorageProvider = {
  id: "music",
  label: "音乐与歌词",
  displayOrder: 3,
  showWhenEmpty: true,
  description: (s) => `${s.entries} 首本地歌曲，包含音频、封面、歌词与歌单`,
  inspect: async () => {
    const d = await readLibrary();
    return {
      entries: d.tracks.length,
      bytes:
        d.tracks.reduce(
          (n, t) =>
            n +
            t.audio.size +
            (t.cover?.size ?? 0) +
            new TextEncoder().encode(t.lyrics).length,
          0,
        ) +
        new TextEncoder().encode(
          JSON.stringify({ lyrics: d.lyrics, prefs: d.prefs, playback: d.playback }),
        ).length,
    };
  },
  exportData: exportMusic,
  validateData: validate,
  restoreData: async (v) => {
    if (!validate(v)) throw new Error("无效的音乐备份");
    await replaceLibrary({
      ...v,
      tracks: v.tracks.map((t) => ({
        ...t,
        audio: decode(t.audio),
        cover: t.cover ? decode(t.cover) : null,
      })) as Track[],
    });
    window.dispatchEvent(new Event("nova-music-storage-changed"));
  },
  clear: async () => {
    await replaceLibrary({ tracks: [], lyrics: [], prefs: initialPreferences });
    window.dispatchEvent(new Event("nova-music-storage-changed"));
  },
};
export default provider;
