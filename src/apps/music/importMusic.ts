import { parseBlob } from "music-metadata";
import type { Track } from "./model";
export async function importMusic(
  file: File,
  source: Track["source"] = "local",
  id = crypto.randomUUID(),
): Promise<Track> {
  const metadata = await parseBlob(file);
  const picture = metadata.common.picture?.[0];
  const title = metadata.common.title || file.name.replace(/\.[^.]+$/, "");
  return {
    id,
    title,
    artist: metadata.common.artist ?? "",
    album: metadata.common.album ?? "",
    name: file.name,
    audio: file,
    cover: picture
      ? new Blob([new Uint8Array(picture.data)], { type: picture.format })
      : null,
    duration: metadata.format.duration ?? 0,
    lyrics: metadata.common.lyrics?.map((l) => l.text ?? "").join("\n") ?? "",
    lyricName: "",
    added: Date.now(),
    favorite: false,
    source,
    offset: 0,
  };
}
