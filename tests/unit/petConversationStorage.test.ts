import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import {
  PET_CONVERSATION_DATABASE_NAME,
  clearPetConversations,
  createPetConversation,
  createPetConversationTitle,
  deletePetConversation,
  readPetConversationState,
  savePetConversation,
  setActivePetConversation,
} from "../../app/petConversationStorage";

afterEach(async () => {
  await clearPetConversations();
});

describe("pet conversation storage", () => {
  it("creates an active local conversation and derives its title", async () => {
    const conversation = await createPetConversation({ id: "first", now: 100 });

    await expect(readPetConversationState()).resolves.toEqual({
      conversations: [conversation],
      activeConversationId: "first",
    });
    expect(createPetConversationTitle("  陪我看看明天的天气  ")).toBe("陪我看看明天的天气");
    expect((await indexedDB.databases()).some(
      ({ name }) => name === PET_CONVERSATION_DATABASE_NAME,
    )).toBe(true);
  });

  it("stores messages, orders updated conversations and switches explicitly", async () => {
    const first = await createPetConversation({ id: "first", now: 100 });
    const second = await createPetConversation({ id: "second", now: 200 });
    await savePetConversation({
      ...first,
      title: "第一段对话",
      updatedAt: 300,
      messages: [{ id: 1, role: "user", text: "第一条" }],
    });
    await setActivePetConversation("first");

    const state = await readPetConversationState();
    expect(state.activeConversationId).toBe("first");
    expect(state.conversations.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(state.conversations[0].messages).toHaveLength(1);
  });

  it("deletes only the selected conversation and clears an active selection", async () => {
    await createPetConversation({ id: "first", now: 100 });
    await createPetConversation({ id: "second", now: 200 });

    await deletePetConversation("second");

    await expect(readPetConversationState()).resolves.toEqual({
      conversations: [{
        id: "first",
        title: "新对话",
        createdAt: 100,
        updatedAt: 100,
        messages: [],
      }],
      activeConversationId: null,
    });
  });
});
