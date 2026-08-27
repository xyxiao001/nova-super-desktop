// Bump this value when the offline asset policy changes.
const VERSION = "nova-pwa-v1";
const SHELL_CACHE = `${VERSION}:shell`;
const RUNTIME_CACHE = `${VERSION}:runtime`;
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-192.png",
  "/pwa-512.png",
  "/default-photo.jpg",
  "/books/catalog.json",
  "/stockfish/stockfish.js",
  "/stockfish/stockfish.wasm",
];
const BUILD_ASSET_PATTERN = /["'`]([^"'`]+?\.(?:css|js|wasm|woff2?|png|jpe?g|webp|svg)(?:\?[^"'`]*)?)["'`]/gi;

const cacheResponse = async (cacheName, request, response) => {
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
};

const cacheShellAssets = async () => {
  const cache = await caches.open(SHELL_CACHE);
  const shellResponse = await fetch(new Request("/", { cache: "reload" }));
  if (!shellResponse.ok) throw new Error("Unable to cache the NOVA shell");
  await cache.put("/", shellResponse.clone());

  const html = await shellResponse.text();
  const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .filter((url) => /\.(?:css|js|woff2?)$/i.test(url.pathname))
    .map((url) => url.pathname + url.search);

  await Promise.all(CORE_ASSETS.slice(1).map(async (path) => {
    const response = await fetch(new Request(path, { cache: "reload" }));
    if (!response.ok) throw new Error(`Unable to cache ${path}`);
    await cache.put(path, response);
  }));
  const pending = [...new Set(assetUrls)];
  const discovered = new Set(pending);
  while (pending.length) {
    const path = pending.shift();
    const response = await fetch(new Request(path, { cache: "reload" }));
    if (!response.ok) continue;
    await cache.put(path, response.clone());
    if (!new URL(path, self.location.origin).pathname.endsWith(".js")) continue;

    const source = await response.text();
    for (const match of source.matchAll(BUILD_ASSET_PATTERN)) {
      let url;
      try {
        url = new URL(match[1], new URL(path, self.location.origin));
      } catch {
        continue;
      }
      const nextPath = url.pathname + url.search;
      if (url.origin !== self.location.origin || url.pathname.startsWith("/books/") || discovered.has(nextPath)) continue;
      discovered.add(nextPath);
      pending.push(nextPath);
    }
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShellAssets());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("nova-pwa-") && name !== SHELL_CACHE && name !== RUNTIME_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

const networkFirstNavigation = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const shell = await caches.match("/");
    if (shell) return shell;
    return new Response("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>NOVA 离线</title><body><main><h1>NOVA 暂时离线</h1><p>重新联网后刷新即可继续。</p></main></body></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  return cacheResponse(RUNTIME_CACHE, request, await fetch(request));
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => cacheResponse(RUNTIME_CACHE, request, response));
  if (!cached) return network;
  void network.catch(() => undefined);
  return cached;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (url.pathname.startsWith("/books/") && url.pathname.endsWith(".txt")) return;
  if (url.pathname === "/books/catalog.json") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (["script", "style", "font", "image", "worker"].includes(request.destination) || /\.(?:css|js|wasm|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
