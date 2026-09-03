import "fake-indexeddb/auto";

import { readFile } from "node:fs/promises";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_CONNECTION_DATABASE_NAME,
  clearAiConnections,
  createAiConnection,
  deleteAiConnection,
  getActiveAiConnection,
  getProactiveAiConnection,
  readAiConnectionState,
  setActiveAiConnection,
  updateAiConnection,
  updateAiSettings,
} from "../../app/aiConnectionStorage";

const connection = (model: string, apiKey: string) => ({
  protocol: "openai-compatible" as const,
  baseUrl: `https://${model}.example.com/v1`,
  model,
  apiKey,
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await deleteDB(AI_CONNECTION_DATABASE_NAME);
});

describe("AI connection storage", () => {
  it("starts disabled without selecting a connection", async () => {
    await expect(readAiConnectionState()).resolves.toEqual({
      profiles: [],
      settings: {
        enabled: false,
        proactiveCompanion: false,
        activeConnectionId: null,
        contextPermissions: {
          activitySummary: true,
          resourceNames: true,
          selectedText: true,
        },
      },
    });
  });

  it("stores multiple complete profiles without exposing full keys in summaries", async () => {
    const first = await createAiConnection(connection("alpha", "secret-alpha"));
    const second = await createAiConnection(connection("beta", "secret-beta"));
    const state = await readAiConnectionState();

    expect(state.profiles).toHaveLength(2);
    expect(state.profiles).toContainEqual(first);
    expect(state.profiles).toContainEqual(second);
    expect(state.profiles).toContainEqual(
      expect.objectContaining({ model: "alpha", apiKeyLastFour: "lpha" }),
    );
    expect(state.profiles).toContainEqual(
      expect.objectContaining({ model: "beta", apiKeyLastFour: "beta" }),
    );
    expect(state.profiles.every((item) => !("apiKey" in item))).toBe(true);
    expect(state.settings.activeConnectionId).toBeNull();

    await setActiveAiConnection(second.id);
    await expect(getActiveAiConnection()).resolves.toEqual({
      id: second.id,
      ...connection("beta", "secret-beta"),
    });
  });

  it("updates one profile as a unit and preserves an omitted replacement key", async () => {
    const profile = await createAiConnection(connection("alpha", "secret-alpha"));

    await updateAiConnection(profile.id, {
      protocol: "openai-compatible",
      baseUrl: "https://updated.example.com/v2",
      model: "updated",
    });
    await setActiveAiConnection(profile.id);

    await expect(getActiveAiConnection()).resolves.toEqual({
      id: profile.id,
      protocol: "openai-compatible",
      baseUrl: "https://updated.example.com/v2",
      model: "updated",
      apiKey: "secret-alpha",
    });
  });

  it("trims key whitespace and rejects a duplicated Bearer prefix", async () => {
    const profile = await createAiConnection(connection("alpha", "  secret-alpha\n"));
    await setActiveAiConnection(profile.id);

    expect((await getActiveAiConnection())?.apiKey).toBe("secret-alpha");
    await expect(createAiConnection(
      connection("beta", "Bearer secret-beta"),
    )).rejects.toThrow("不要包含 Bearer 前缀");
  });

  it("does not replace the current profile when another profile is deleted", async () => {
    const first = await createAiConnection(connection("alpha", "secret-alpha"));
    const second = await createAiConnection(connection("beta", "secret-beta"));
    await setActiveAiConnection(first.id);

    await deleteAiConnection(second.id);
    expect((await readAiConnectionState()).settings.activeConnectionId).toBe(first.id);

    await deleteAiConnection(first.id);
    const state = await readAiConnectionState();
    expect(state.settings.activeConnectionId).toBeNull();
    expect(state.profiles).toEqual([]);
  });

  it("persists settings and clears profiles, selection, and permissions together", async () => {
    const profile = await createAiConnection(connection("alpha", "secret-alpha"));
    await setActiveAiConnection(profile.id);
    await updateAiSettings({
      enabled: true,
      proactiveCompanion: true,
      contextPermissions: {
        activitySummary: false,
        resourceNames: true,
        selectedText: true,
      },
    });

    expect((await readAiConnectionState()).settings).toEqual({
      enabled: true,
      proactiveCompanion: true,
      activeConnectionId: profile.id,
      contextPermissions: {
        activitySummary: false,
        resourceNames: true,
        selectedText: true,
      },
    });

    await clearAiConnections();
    await expect(readAiConnectionState()).resolves.toEqual({
      profiles: [],
      settings: {
        enabled: false,
        proactiveCompanion: false,
        activeConnectionId: null,
        contextPermissions: {
          activitySummary: true,
          resourceNames: true,
          selectedText: true,
        },
      },
    });
  });

  it("requires separate proactive consent and clears it with the active connection", async () => {
    const profile = await createAiConnection(connection("alpha", "secret-alpha"));
    await setActiveAiConnection(profile.id);
    await updateAiSettings({ enabled: true });

    await expect(getProactiveAiConnection()).resolves.toBeNull();

    await updateAiSettings({ proactiveCompanion: true });
    await expect(getProactiveAiConnection()).resolves.toMatchObject({
      id: profile.id,
      model: "alpha",
    });

    await updateAiSettings({ enabled: false });
    expect((await readAiConnectionState()).settings.proactiveCompanion).toBe(false);
    await updateAiSettings({ enabled: true, proactiveCompanion: true });
    await setActiveAiConnection(null);
    expect((await readAiConnectionState()).settings.proactiveCompanion).toBe(false);
    await expect(getProactiveAiConnection()).resolves.toBeNull();
  });

  it("does not use localStorage, backup providers, or Service Worker caches", async () => {
    vi.stubGlobal("localStorage", new Proxy({}, {
      get() {
        throw new Error("localStorage must not be accessed");
      },
    }));
    await createAiConnection(connection("alpha", "secret-alpha"));

    const [storageSource, manifest, serviceWorker] = await Promise.all([
      readFile(new URL("../../app/aiConnectionStorage.ts", import.meta.url), "utf8"),
      readFile(new URL("../../src/platform/apps/appManifest.ts", import.meta.url), "utf8"),
      readFile(new URL("../../public/sw.js", import.meta.url), "utf8"),
    ]);
    expect(storageSource).not.toContain("localStorage");
    expect(manifest).not.toContain("aiConnectionStorage");
    expect(manifest).not.toContain(AI_CONNECTION_DATABASE_NAME);
    expect(serviceWorker).not.toContain(AI_CONNECTION_DATABASE_NAME);
  });
});
