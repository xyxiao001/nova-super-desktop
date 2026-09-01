import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
const resourcePackages = readFileSync(
  new URL("../../public/resource-packages.generated.js", import.meta.url),
  "utf8",
);

describe("service worker resource policy", () => {
  it("keeps the install shell minimal and avoids recursive chunk discovery", () => {
    expect(source).toContain('const VERSION = "nova-pwa-v22"');
    expect(source).not.toContain("BUILD_ASSET_PATTERN");
    expect(source).not.toContain("while (pending.length)");
  });

  it("serves the cached app shell before refreshing navigation in the background", () => {
    expect(source).toContain("const appShellNavigation = (event) =>");
    expect(source).toContain('const cached = await cache.match(request) ?? await cache.match("/")');
    expect(source).toContain("event.waitUntil(network.catch(() => undefined))");
    expect(source).toContain("event.respondWith(appShellNavigation(event))");
    expect(source).not.toContain("networkFirstNavigation");
  });

  it("returns the cached shell when a navigation starts offline", async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const shellResponse = new Response("<main>NOVA desktop</main>");
    const cache = {
      match: vi.fn(async (request: unknown) => request === "/" ? shellResponse : undefined),
      put: vi.fn(),
      keys: vi.fn(async () => []),
    };
    const worker = {
      NOVA_RESOURCE_PACKAGES: [],
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
      clients: { claim: vi.fn() },
      location: { origin: "https://nova.test" },
      skipWaiting: vi.fn(),
    };
    runInNewContext(source, {
      URL,
      Request,
      Response,
      caches: {
        delete: vi.fn(),
        keys: vi.fn(async () => []),
        match: vi.fn(),
        open: vi.fn(async () => cache),
      },
      fetch: vi.fn(async () => {
        throw new TypeError("offline");
      }),
      importScripts: vi.fn(),
      self: worker,
    });

    let responsePromise: Promise<Response> | undefined;
    let lifetimePromise: Promise<unknown> | undefined;
    listeners.get("fetch")?.({
      request: {
        destination: "document",
        method: "GET",
        mode: "navigate",
        url: "https://nova.test/",
      },
      respondWith: (value: Promise<Response>) => {
        responsePromise = value;
      },
      waitUntil: (value: Promise<unknown>) => {
        lifetimePromise = value;
      },
    });

    expect(responsePromise).toBeDefined();
    expect(lifetimePromise).toBeDefined();
    await expect(responsePromise).resolves.toBe(shellResponse);
    await expect(lifetimePromise).resolves.toBeUndefined();
  });

  it("keeps the generated offline document cross-origin isolated", () => {
    expect(source).toContain('"Cross-Origin-Opener-Policy": "same-origin"');
    expect(source).toContain('"Cross-Origin-Embedder-Policy": "require-corp"');
    expect(source).toContain("...ISOLATION_HEADERS");
  });

  it("keeps large features in independent on-demand caches", () => {
    expect(source).toContain('importScripts("/resource-packages.generated.js")');
    expect(resourcePackages).toContain('"id": "magic-tower"');
    expect(resourcePackages).toContain('"id": "youtd2"');
    expect(resourcePackages).toContain('"id": "chess-engine"');
    expect(resourcePackages).toContain('"id": "books"');
    expect(resourcePackages).toContain('"id": "photos"');
    expect(resourcePackages).toContain('"id": "apps"');
    expect(source).toContain("GET_RESOURCE_CACHE_STATUS");
    expect(source).toContain("CLEAR_RESOURCE_CACHE");
    expect(source).toContain("CLEAR_ALL_RESOURCE_CACHES");
  });

  it("does not put partial range responses into Cache Storage", () => {
    expect(source).toContain('response.status === 200 && response.type === "basic"');
    expect(source).not.toContain("response.ok && response.type === \"basic\"");
  });
});
