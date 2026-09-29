import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rankSongs } from "./netease.mjs";

// API fields follow LDDC/core/api/lyrics/qm.py; lyric decoding is a separate GPL CLI.
async function request(method, module, param) {
  const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "tmeLoginType=-1;", "User-Agent": "okhttp/3.14.9" },
    body: JSON.stringify({
      comm: { ct: 11, cv: "1003006", v: "1003006", tmeAppID: "qqmusiclight", udid: "0" },
      request: { method, module, param },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0 || data.request.code !== 0) throw new Error(`QQ 音乐请求失败 (${data.code}/${data.request?.code})`);
  return data.request.data;
}

export async function searchSongs(title) {
  const data = await request("DoSearchForQQMusicLite", "music.search.SearchCgiService", {
    query: title, search_type: 0, num_per_page: 50, page_num: 1,
    highlight: 0, nqc_flag: 0, page_id: 1, grp: 1, remoteplace: "search.android.keyboard",
  });
  return data.body.item_song.map((song) => ({
    id: song.id, title: song.title, artists: song.singer.map((artist) => artist.name),
    album: song.album.name, duration: song.interval,
  }));
}

export function decodeQrc(encrypted) {
  return new Promise((resolve, reject) => {
    const process = spawn("python3", [fileURLToPath(new URL("./vendor/decrypt-qrc.py", import.meta.url))]);
    const output = [], errors = [];
    process.stdout.on("data", (chunk) => output.push(chunk));
    process.stderr.on("data", (chunk) => errors.push(chunk));
    process.on("error", reject);
    process.on("close", (code) => code === 0
      ? resolve(Buffer.concat(output).toString("utf8"))
      : reject(new Error(Buffer.concat(errors).toString("utf8"))));
    process.stdin.end(encrypted);
  });
}

export async function getWordLyrics(song) {
  const base64 = (value) => Buffer.from(value).toString("base64");
  const data = await request("GetPlayLyricInfo", "music.musichallSong.PlayLyricInfo", {
    songID: song.id, songName: base64(song.title), singerName: base64(song.artists.join("/")),
    albumName: base64(song.album), interval: Math.floor(song.duration),
    crypt: 1, ct: 19, cv: 2111, lrc_t: 0, qrc: 1, qrc_t: 0,
    roma: 0, roma_t: 0, trans: 0, trans_t: 0, type: 0,
  });
  return data.qrc_t && data.lyric ? decodeQrc(data.lyric) : null;
}

export async function matchTrack(track) {
  for (const song of rankSongs(track, await searchSongs(track.title))) {
    const lyrics = await getWordLyrics(song);
    if (lyrics && /\[\d+,\d+\].+\(\d+,\d+\)/.test(lyrics)) {
      return { source: "qq", format: "qrc", song, lyrics };
    }
  }
  return null;
}
