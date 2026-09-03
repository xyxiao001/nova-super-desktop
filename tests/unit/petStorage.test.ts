import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { createPetData } from "../../app/petModel";
import {
  createPetConversation,
  readPetConversationState,
} from "../../app/petConversationStorage";
import {
  PET_DATABASE_NAME,
  clearPetData,
  createPetRuntimeStorageQueue,
  loadPetData,
  savePetData,
  savePetPreferences,
  savePetRuntime,
} from "../../app/petStorage";

afterEach(async () => {
  await clearPetData();
});

describe("pet storage", () => {
  it("stores and reloads the complete pet data set", async () => {
    const data = createPetData({
      name: "Nova",
      personality: "curious",
      id: "pet-1",
      now: 100,
    });

    await savePetData(data);
    await expect(loadPetData()).resolves.toEqual(data);

    const databaseNames = await indexedDB.databases();
    expect(databaseNames.some(({ name }) => name === PET_DATABASE_NAME)).toBe(true);
  });

  it("updates runtime state and memory without changing profile or preferences", async () => {
    const data = createPetData({
      name: "Nova",
      personality: "quiet",
      id: "pet-1",
      now: 100,
    });
    await savePetData(data);
    const state = {
      ...data.state,
      mood: "happy" as const,
      affinity: 8,
      lastActiveAt: 200,
    };
    const memory = {
      ...data.memory,
      eventCounts: { "file-created": 2 },
    };

    await savePetRuntime(state, memory);

    await expect(loadPetData()).resolves.toEqual({
      ...data,
      state,
      memory,
    });
  });

  it("updates preferences independently", async () => {
    const data = createPetData({
      name: "Nova",
      personality: "lively",
      id: "pet-1",
      now: 100,
    });
    await savePetData(data);
    const preferences = {
      enabled: false,
      motion: "static" as const,
      sound: false,
      bubbleFrequency: "low" as const,
    };

    await savePetPreferences(preferences);

    expect((await loadPetData())?.preferences).toEqual(preferences);
  });

  it("discards stale queued runtime writes before resetting pet data", async () => {
    const first = createPetData({
      name: "Old",
      personality: "quiet",
      id: "old-pet",
      now: 100,
    });
    const replacement = createPetData({
      name: "Nova",
      personality: "curious",
      id: "new-pet",
      now: 500,
    });
    const calls: string[] = [];
    let releaseFirstWrite = () => {};
    let notifyFirstWriteStarted = () => {};
    const firstWriteStarted = new Promise<void>((resolve) => {
      notifyFirstWriteStarted = resolve;
    });
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const queue = createPetRuntimeStorageQueue({
      saveRuntime: async (state) => {
        calls.push(`runtime:${state.lastActiveAt}:start`);
        if (state.lastActiveAt === 100) {
          notifyFirstWriteStarted();
          await firstWriteBlocked;
        }
        calls.push(`runtime:${state.lastActiveAt}:end`);
      },
      replaceData: async (data) => {
        calls.push(`reset:${data.profile.id}`);
      },
    });

    const activeWrite = queue.saveRuntime(first.state, first.memory);
    await firstWriteStarted;
    const staleQueuedWrite = queue.saveRuntime(
      { ...first.state, lastActiveAt: 200 },
      first.memory,
    );
    const reset = queue.reset(replacement);
    const writeDuringReset = queue.saveRuntime(
      { ...first.state, lastActiveAt: 300 },
      first.memory,
    );
    releaseFirstWrite();

    await Promise.all([activeWrite, staleQueuedWrite, reset, writeDuringReset]);
    expect(calls).toEqual([
      "runtime:100:start",
      "runtime:100:end",
      "reset:new-pet",
    ]);

    await queue.saveRuntime(replacement.state, replacement.memory);
    expect(calls.at(-1)).toBe(`runtime:${replacement.state.lastActiveAt}:end`);
  });

  it("deletes only the pet database", async () => {
    await savePetData(createPetData({
      name: "Nova",
      personality: "curious",
      id: "pet-1",
      now: 100,
    }));
    await createPetConversation({ id: "conversation-1", now: 100 });
    const otherDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("unrelated-pet-test", 1);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => request.result.createObjectStore("items");
      request.onsuccess = () => resolve(request.result);
    });
    otherDatabase.close();

    await clearPetData();

    await expect(loadPetData()).resolves.toBeNull();
    await expect(readPetConversationState()).resolves.toEqual({
      conversations: [],
      activeConversationId: null,
    });
    expect((await indexedDB.databases()).some(({ name }) => name === "unrelated-pet-test")).toBe(true);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("unrelated-pet-test");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  });
});
