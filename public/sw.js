importScripts("/resource-packages.generated.js");

const VERSION = "nova-pwa-v26";
const CACHE_PREFIX = "nova-pwa-";
const SHELL_CACHE = `${VERSION}:shell`;
const RESOURCE_CACHE_PREFIX = `${VERSION}:resource:`;
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-192.png",
  "/pwa-512.png",
];

const RESOURCE_PACKAGES = self.NOVA_RESOURCE_PACKAGES;
const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const resourceCacheName = (id) => `${RESOURCE_CACHE_PREFIX}${id}`;

const findResourcePackage = (request, url) => (
  RESOURCE_PACKAGES.find((item) => (
    item.pathPrefixes.some((prefix) => url.pathname.startsWith(prefix))
    || item.exactPaths.includes(url.pathname)
    || item.destinations.includes(request.destination)
    || item.extensions.some((extension) => url.pathname.toLowerCase().endsWith(`.${extension}`))
  ))
);

const putResponse = async (cacheName, request, response) => {
  if (response.status === 200 && response.type === "basic") {
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
  const documentAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .filter((url) => /\.(?:css|js|woff2?)$/i.test(url.pathname))
    .map((url) => url.pathname + url.search);

  await Promise.all([...new Set([...CORE_ASSETS.slice(1), ...documentAssets])].map(async (path) => {
    const response = await fetch(new Request(path, { cache: "reload" }));
    if (!response.ok) throw new Error(`Unable to cache ${path}`);
    await cache.put(path, response);
  }));
};

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShellAssets());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const currentCaches = new Set([
      SHELL_CACHE,
      ...RESOURCE_PACKAGES.map((item) => resourceCacheName(item.id)),
    ]);
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && !currentCaches.has(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

const inspectCache = async (name, existingNames) => {
  if (!existingNames.has(name)) return { entries: 0, bytes: 0 };
  const cache = await caches.open(name);
  const requests = await cache.keys();
  let bytes = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;
    const contentLength = Number(response.headers.get("content-length"));
    bytes += Number.isFinite(contentLength) && contentLength > 0
      ? contentLength
      : (await response.clone().arrayBuffer()).byteLength;
  }
  return { entries: requests.length, bytes };
};

const inspectResourceCaches = async () => {
  const existingNames = new Set(await caches.keys());
  const shell = await inspectCache(SHELL_CACHE, existingNames);
  const resources = await Promise.all(RESOURCE_PACKAGES.map(async (item) => ({
    id: item.id,
    cacheName: resourceCacheName(item.id),
    ...(await inspectCache(resourceCacheName(item.id), existingNames)),
  })));
  return [
    {
      id: "system",
      cacheName: SHELL_CACHE,
      ...shell,
    },
    ...resources,
  ];
};

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }
  if (event.data?.type === "GET_RESOURCE_CACHE_STATUS" && event.ports[0]) {
    event.waitUntil(inspectResourceCaches()
      .then((packages) => event.ports[0].postMessage({ ok: true, packages }))
      .catch((error) => event.ports[0].postMessage({
        ok: false,
        error: error instanceof Error ? error.message : "缓存读取失败",
      })));
    return;
  }
  if (event.data?.type === "CLEAR_RESOURCE_CACHE" && event.ports[0]) {
    const packageId = event.data.packageId;
    const cacheName = packageId === "system"
      ? SHELL_CACHE
      : RESOURCE_PACKAGES.some((item) => item.id === packageId)
        ? resourceCacheName(packageId)
        : null;
    if (!cacheName) {
      event.ports[0].postMessage({ ok: false, error: "未知资源包" });
      return;
    }
    event.waitUntil(caches.delete(cacheName)
      .then(() => event.ports[0].postMessage({ ok: true }))
      .catch((error) => event.ports[0].postMessage({
        ok: false,
        error: error instanceof Error ? error.message : "缓存删除失败",
      })));
    return;
  }
  if (event.data?.type === "CLEAR_ALL_RESOURCE_CACHES" && event.ports[0]) {
    event.waitUntil(caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith(CACHE_PREFIX))
        .map((name) => caches.delete(name))))
      .then(() => event.ports[0].postMessage({ ok: true }))
      .catch((error) => event.ports[0].postMessage({
        ok: false,
        error: error instanceof Error ? error.message : "缓存清理失败",
      })));
  }
});

const appShellNavigation = (event) => {
  const { request } = event;
  const cachePromise = caches.open(SHELL_CACHE);
  const network = cachePromise.then(async (cache) => {
    const response = await fetch(request);
    if (response.ok && new URL(request.url).pathname === "/") {
      await cache.put("/", response.clone());
    }
    return response;
  });
  event.waitUntil(network.catch(() => undefined));

  return cachePromise.then(async (cache) => {
    const cached = await cache.match(request) ?? await cache.match("/");
    if (cached) return cached;

    try {
      return await network;
    } catch {
      return new Response("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>NOVA 离线</title><body><main><h1>NOVA 暂时离线</h1><p>重新联网后刷新即可继续。</p></main></body></html>", {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...ISOLATION_HEADERS,
        },
      });
    }
  });
};

const cacheFirst = async (cacheName, request) => {
  const shellMatch = await caches.match(request);
  if (shellMatch) return shellMatch;
  return putResponse(cacheName, request, await fetch(request));
};

const staleWhileRevalidate = async (cacheName, request) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => putResponse(cacheName, request, response));
  if (!cached) return network;
  void network.catch(() => undefined);
  return cached;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  const resourcePackage = findResourcePackage(request, url);
  if (resourcePackage) {
    const cacheName = resourceCacheName(resourcePackage.id);
    event.respondWith(
      url.pathname === "/books/catalog.json"
        ? staleWhileRevalidate(cacheName, request)
        : cacheFirst(cacheName, request),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(appShellNavigation(event));
  }
});
