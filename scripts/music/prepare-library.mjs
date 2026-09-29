import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import { parseLyrics } from "../../src/apps/music/lyrics.ts";

const run = promisify(execFile);
const [inventoryFile, matchesDirectory, outputDirectory] = process.argv.slice(2);
const tracks = JSON.parse(await readFile(inventoryFile, "utf8"));
await mkdir(outputDirectory, { recursive: true });
const catalog = [], report = [];
const stamp = (seconds) => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 60_000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};
for (const [index, track] of tracks.entries()) {
  const { match } = JSON.parse(await readFile(path.join(matchesDirectory, `${index}.json`), "utf8"));
  const parsed = parseLyrics(match.lyrics, track.duration);
  const lines = parsed.lines.filter((line) => Number.isFinite(line.start));
  const id = track.id;
  const audioFile = `${id}.mp3`, lyricsFile = `${id}.lrc`;
  const audioPath = path.join(outputDirectory, audioFile);
  const lyrics = [`[ti:${track.title}]`, `[ar:${track.artist}]`, `[offset:${parsed.offset * 1000}]`,
    ...lines.map((line) => line.words.length
      ? `[${stamp(line.start)}]${line.words.map((word) => `<${stamp(word.start)}>${word.text}<${stamp(word.end)}>`).join("")}`
      : `[${stamp(line.start)}]${line.text}`),
  ].join("\n") + "\n";
  await writeFile(path.join(outputDirectory, lyricsFile), lyrics);
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", track.file,
    "-map", "0:a:0", "-map", "0:v:0?", "-c:v", "copy", "-c:a", "libmp3lame", "-b:a", "192k",
    "-map_metadata", "0", "-id3v2_version", "3", audioPath]);
  const metadata = await parseFile(audioPath);
  const picture = metadata.common.picture?.[0];
  const cover = picture ? `${id}.${picture.format === "image/png" ? "png" : "jpg"}` : null;
  if (picture) await writeFile(path.join(outputDirectory, cover), picture.data);
  const bytes = await readFile(audioPath);
  catalog.push({ id, title: track.title, artist: track.artist, album: track.album,
    audio: `/music/${audioFile}`, lyrics: `/music/${lyricsFile}`, cover: cover ? `/music/${cover}` : null,
    bytes: bytes.length, audioHash: createHash("sha256").update(bytes).digest("hex"),
  });
  report.push({ title: track.title, artist: track.artist, source: match.source, songId: match.song.id,
    sourceDuration: track.duration, encodedDuration: metadata.format.duration,
    matchedDuration: match.song.duration, wordLines: lines.filter((line) => line.words.length).length,
    lyricEnd: lines.at(-1)?.end, bytes: bytes.length });
  console.log(`${index + 1}/${tracks.length} ${track.title} ${match.source} ${Math.round(bytes.length / 1024)} KiB`);
}
await writeFile(path.join(outputDirectory, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
await writeFile(path.join(path.dirname(outputDirectory), "music-preparation-report.json"), JSON.stringify(report, null, 2) + "\n");
