import { createCipheriv, createHash } from "node:crypto";

// Protocol reference: LDDC/core/api/lyrics/ne.py and core/decryptor/eapi.py.
// This local preparation tool uses Node's crypto implementation, without account cookies.
const headers = {
  "Content-Type": "application/x-www-form-urlencoded",
  Referer: "https://music.163.com",
};

export async function searchSongs(title) {
  const response = await fetch("https://music.163.com/api/search/get", {
    method: "POST", headers,
    body: new URLSearchParams({ s: title, type: "1", limit: "100", offset: "0" }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 200) throw new Error(`网易云搜索失败 (${data.code})`);
  return data.result.songs.map((song) => ({
    id: song.id, title: song.name, artists: song.artists.map((artist) => artist.name),
    album: song.album.name, duration: song.duration / 1000,
  }));
}

export async function getWordLyrics(id) {
  const path = "/api/song/lyric/v1";
  const json = JSON.stringify({ id: Number(id), lv: -1, tv: -1, rv: -1, yv: -1, e_r: false });
  const digest = createHash("md5").update(`nobody${path}use${json}md5forencrypt`).digest("hex");
  const cipher = createCipheriv("aes-128-ecb", "e82ckenh8dichen8", null);
  const params = Buffer.concat([
    cipher.update(`${path}-36cd479b6b5-${json}-36cd479b6b5-${digest}`), cipher.final(),
  ]).toString("hex").toUpperCase();
  const response = await fetch("https://interface.music.163.com/eapi/song/lyric/v1", {
    method: "POST", headers: { ...headers, Cookie: "os=pc; appver=3.1.3.203419" },
    body: new URLSearchParams({ params }), signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 200) throw new Error(`网易云歌词请求失败 (${data.code})`);
  return data.yrc?.lyric ?? null;
}

const normalized = (text) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function rankSongs(track, songs) {
  return songs.filter((song) => normalized(song.title) === normalized(track.title)
    && song.artists.some((artist) => normalized(artist) === normalized(track.artist)))
    .sort((a, b) => Math.abs(a.duration - track.duration) - Math.abs(b.duration - track.duration));
}

export async function matchTrack(track) {
  const candidates = rankSongs(track, await searchSongs(track.title));
  for (const song of candidates) {
    const lyrics = await getWordLyrics(song.id);
    if (lyrics && /\[\d+,\d+\]\(\d+,\d+,\d+\)/.test(lyrics)) {
      return { source: "netease", format: "yrc", song, lyrics };
    }
  }
  return null;
}
