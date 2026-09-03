import { deleteDB, openDB, type DBSchema } from "idb";

import type {
  PetData,
  PetMemory,
  PetPreferences,
  PetProfile,
  PetState,
} from "./petModel";
import { clearPetConversations } from "./petConversationStorage";

export const PET_DATABASE_NAME = "nova-pet";

const DATABASE_VERSION = 1;
const CURRENT_KEY = "current";

interface PetDatabase extends DBSchema {
  profile: {
    key: string;
    value: PetProfile;
  };
  state: {
    key: string;
    value: PetState;
  };
  memory: {
    key: string;
    value: PetMemory;
  };
  preferences: {
    key: string;
    value: PetPreferences;
  };
}

const openPetDatabase = () => openDB<PetDatabase>(
  PET_DATABASE_NAME,
  DATABASE_VERSION,
  {
    upgrade(database) {
      database.createObjectStore("profile");
      database.createObjectStore("state");
      database.createObjectStore("memory");
      database.createObjectStore("preferences");
    },
  },
);

export async function loadPetData(): Promise<PetData | null> {
  const database = await openPetDatabase();
  try {
    const [profile, state, memory, preferences] = await Promise.all([
      database.get("profile", CURRENT_KEY),
      database.get("state", CURRENT_KEY),
      database.get("memory", CURRENT_KEY),
      database.get("preferences", CURRENT_KEY),
    ]);
    if (!profile && !state && !memory && !preferences) return null;
    if (!profile || !state || !memory || !preferences) {
      throw new Error("宠物本地数据不完整");
    }
    return { profile, state, memory, preferences };
  } finally {
    database.close();
  }
}

export async function savePetData(data: PetData): Promise<void> {
  const database = await openPetDatabase();
  try {
    const transaction = database.transaction(
      ["profile", "state", "memory", "preferences"],
      "readwrite",
    );
    await Promise.all([
      transaction.objectStore("profile").put(data.profile, CURRENT_KEY),
      transaction.objectStore("state").put(data.state, CURRENT_KEY),
      transaction.objectStore("memory").put(data.memory, CURRENT_KEY),
      transaction.objectStore("preferences").put(data.preferences, CURRENT_KEY),
    ]);
    await transaction.done;
  } finally {
    database.close();
  }
}

export async function savePetRuntime(
  state: PetState,
  memory: PetMemory,
): Promise<void> {
  const database = await openPetDatabase();
  try {
    const transaction = database.transaction(["state", "memory"], "readwrite");
    await Promise.all([
      transaction.objectStore("state").put(state, CURRENT_KEY),
      transaction.objectStore("memory").put(memory, CURRENT_KEY),
    ]);
    await transaction.done;
  } finally {
    database.close();
  }
}

export async function savePetPreferences(
  preferences: PetPreferences,
): Promise<void> {
  const database = await openPetDatabase();
  try {
    await database.put("preferences", preferences, CURRENT_KEY);
  } finally {
    database.close();
  }
}

export async function clearPetData(): Promise<void> {
  await Promise.all([
    deleteDB(PET_DATABASE_NAME),
    clearPetConversations(),
  ]);
}
