import { deleteDB, openDB, type DBSchema } from "idb";

import type { PetDialogueAction } from "./petDialogue";

export const PET_CONVERSATION_DATABASE_NAME = "nova-pet-conversations";

const DATABASE_VERSION = 1;
const SETTINGS_KEY = "settings";

export type StoredPetConversationMessage = {
  id: number;
  role: "user" | "pet";
  text: string;
  action?: PetDialogueAction;
};

export type StoredPetConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredPetConversationMessage[];
};

type StoredPetConversationSettings = {
  key: typeof SETTINGS_KEY;
  activeConversationId: string | null;
};

interface PetConversationDatabase extends DBSchema {
  conversations: {
    key: string;
    value: StoredPetConversation;
    indexes: { "by-updated-at": number };
  };
  settings: {
    key: string;
    value: StoredPetConversationSettings;
  };
}

const openPetConversationDatabase = () => openDB<PetConversationDatabase>(
  PET_CONVERSATION_DATABASE_NAME,
  DATABASE_VERSION,
  {
    upgrade(database) {
      const conversations = database.createObjectStore("conversations", { keyPath: "id" });
      conversations.createIndex("by-updated-at", "updatedAt");
      database.createObjectStore("settings", { keyPath: "key" });
    },
  },
);

export const createPetConversationTitle = (message: string) => (
  message.trim().replace(/\s+/g, " ").slice(0, 18) || "新对话"
);

export async function readPetConversationState(): Promise<{
  conversations: StoredPetConversation[];
  activeConversationId: string | null;
}> {
  const database = await openPetConversationDatabase();
  try {
    const [conversations, settings] = await Promise.all([
      database.getAllFromIndex("conversations", "by-updated-at"),
      database.get("settings", SETTINGS_KEY),
    ]);
    return {
      conversations: conversations.reverse(),
      activeConversationId: settings?.activeConversationId ?? null,
    };
  } finally {
    database.close();
  }
}

export async function createPetConversation({
  id = crypto.randomUUID(),
  now = Date.now(),
}: {
  id?: string;
  now?: number;
} = {}): Promise<StoredPetConversation> {
  const conversation: StoredPetConversation = {
    id,
    title: "新对话",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  const database = await openPetConversationDatabase();
  try {
    const transaction = database.transaction(["conversations", "settings"], "readwrite");
    await Promise.all([
      transaction.objectStore("conversations").add(conversation),
      transaction.objectStore("settings").put({
        key: SETTINGS_KEY,
        activeConversationId: conversation.id,
      }),
    ]);
    await transaction.done;
    return conversation;
  } finally {
    database.close();
  }
}

export async function savePetConversation(
  conversation: StoredPetConversation,
): Promise<void> {
  const database = await openPetConversationDatabase();
  try {
    await database.put("conversations", conversation);
  } finally {
    database.close();
  }
}

export async function setActivePetConversation(id: string | null): Promise<void> {
  const database = await openPetConversationDatabase();
  try {
    await database.put("settings", { key: SETTINGS_KEY, activeConversationId: id });
  } finally {
    database.close();
  }
}

export async function deletePetConversation(id: string): Promise<void> {
  const database = await openPetConversationDatabase();
  try {
    const transaction = database.transaction(["conversations", "settings"], "readwrite");
    const settings = await transaction.objectStore("settings").get(SETTINGS_KEY);
    await transaction.objectStore("conversations").delete(id);
    if (settings?.activeConversationId === id) {
      await transaction.objectStore("settings").put({
        key: SETTINGS_KEY,
        activeConversationId: null,
      });
    }
    await transaction.done;
  } finally {
    database.close();
  }
}

export async function clearPetConversations(): Promise<void> {
  await deleteDB(PET_CONVERSATION_DATABASE_NAME);
}
