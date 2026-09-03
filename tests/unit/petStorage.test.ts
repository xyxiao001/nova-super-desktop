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
