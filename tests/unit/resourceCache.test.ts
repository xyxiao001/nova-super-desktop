import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearAllResourceCaches,
  clearResourceCache,
  inspectResourceCaches,
} from "../../app/resourceCache";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resource cache client", () => {
  it("returns the package catalog when no service worker is available", async () => {
    vi.stubGlobal("navigator", {});

    const packages = await inspectResourceCaches();

    expect(packages.map((item) => item.id)).toEqual([
      "system",
      "apps",
      "photos",
      "books",
      "chess-engine",
      "magic-tower",
      "media",
    ]);
    expect(packages.every((item) => item.entries === 0 && item.bytes === 0)).toBe(true);
  });

  it("does not report a successful deletion without a service worker", async () => {
    vi.stubGlobal("navigator", {});

    await expect(clearResourceCache("apps")).rejects.toThrow(
      "Service Worker 尚未接管页面",
    );
    await expect(clearAllResourceCaches()).rejects.toThrow(
      "Service Worker 尚未接管页面",
    );
  });

  it("requests a namespace-wide resource reset from the service worker", async () => {
    let sentMessage: unknown;
    class MockMessageChannel {
      port1: { onmessage: ((event: MessageEvent) => void) | null } = { onmessage: null };
      port2 = {
        postMessage: (data: unknown) => this.port1.onmessage?.({ data } as MessageEvent),
      };
    }
    const worker = {
      postMessage: (message: unknown, ports: Array<{ postMessage: (data: unknown) => void }>) => {
        sentMessage = message;
        ports[0].postMessage({ ok: true });
      },
    };
    vi.stubGlobal("MessageChannel", MockMessageChannel);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        controller: worker,
        getRegistration: vi.fn().mockResolvedValue({ active: worker }),
      },
    });

    await clearAllResourceCaches();

    expect(sentMessage).toEqual({ type: "CLEAR_ALL_RESOURCE_CACHES" });
  });
});
