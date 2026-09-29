import { createServer } from "node:http";
import { matchTrack, searchSongs, getWordLyrics } from "./netease.mjs";
import { matchTrack as matchQQ } from "./qq.mjs";

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3310");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    let result;
    if (request.method === "GET" && url.pathname === "/search") {
      result = await searchSongs(url.searchParams.get("title"));
    } else if (request.method === "GET" && url.pathname === "/lyrics") {
      result = { lyrics: await getWordLyrics(url.searchParams.get("id")) };
    } else if (request.method === "POST" && url.pathname === "/match") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const track = JSON.parse(Buffer.concat(chunks).toString());
      result = await (url.searchParams.get("source") === "qq" ? matchQQ : matchTrack)(track);
    } else {
      response.writeHead(404).end(JSON.stringify({ error: "Unknown route" }));
      return;
    }
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(502).end(JSON.stringify({ error: error.message }));
  }
});

server.listen(3310, "127.0.0.1", () => console.log("本地逐字歌词服务：http://127.0.0.1:3310"));
