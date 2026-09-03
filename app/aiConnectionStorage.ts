import { openDB, type DBSchema } from "idb";

export const AI_CONNECTION_DATABASE_NAME = "nova-ai-connections";

const DATABASE_VERSION = 1;
const PROFILE_STORE = "profiles";
const SETTINGS_STORE = "settings";
const SETTINGS_KEY = "settings";

export type NovaAiConnectionProtocol = "openai-compatible";

export type NovaAiConnectionProfile = {
  id: string;
  protocol: NovaAiConnectionProtocol;
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type NovaAiConnectionSummary = Omit<NovaAiConnectionProfile, "apiKey"> & {
  apiKeyLastFour: string;
};

export type NovaAiContextPermissions = {
  activitySummary: boolean;
  resourceNames: boolean;
  selectedText: boolean;
};

export type NovaAiSettings = {
  enabled: boolean;
  activeConnectionId: string | null;
  contextPermissions: NovaAiContextPermissions;
};

export type NovaAiConnectionInput = Omit<NovaAiConnectionProfile, "id">;

type StoredAiSettings = NovaAiSettings & { key: typeof SETTINGS_KEY };

interface AiConnectionDatabase extends DBSchema {
  profiles: {
    key: string;
    value: NovaAiConnectionProfile;
  };
  settings: {
    key: string;
    value: StoredAiSettings;
  };
}

export const DEFAULT_AI_SETTINGS: NovaAiSettings = {
  enabled: false,
  activeConnectionId: null,
  contextPermissions: {
    activitySummary: true,
    resourceNames: true,
    selectedText: true,
  },
};

const openAiConnectionDatabase = () => openDB<AiConnectionDatabase>(
  AI_CONNECTION_DATABASE_NAME,
  DATABASE_VERSION,
  {
    upgrade(database) {
      database.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
    },
  },
);

const normalizeProfileInput = (
  input: NovaAiConnectionInput,
): NovaAiConnectionInput => {
  const baseUrl = input.baseUrl.trim();
  const model = input.model.trim();
  if (!baseUrl || !model || !input.apiKey.trim()) {
    throw new Error("请求地址、模型名称和 API Key 均不能为空");
  }
  const apiKey = input.apiKey.trim();
  if (/^Bearer\s+/i.test(apiKey)) {
    throw new Error("API Key 请输入原始值，不要包含 Bearer 前缀");
  }
  const parsedUrl = new URL(baseUrl);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("请求地址必须使用 HTTP 或 HTTPS");
  }
  return {
    protocol: "openai-compatible",
    baseUrl,
    model,
    apiKey,
  };
};

const toSummary = (
  profile: NovaAiConnectionProfile,
): NovaAiConnectionSummary => ({
  id: profile.id,
  protocol: profile.protocol,
  baseUrl: profile.baseUrl,
  model: profile.model,
  apiKeyLastFour: profile.apiKey.slice(-4),
});

const toStoredSettings = (settings: NovaAiSettings): StoredAiSettings => ({
  key: SETTINGS_KEY,
  ...settings,
});

export async function readAiConnectionState(): Promise<{
  profiles: NovaAiConnectionSummary[];
  settings: NovaAiSettings;
}> {
  const database = await openAiConnectionDatabase();
  try {
    const [profiles, settings] = await Promise.all([
      database.getAll(PROFILE_STORE),
      database.get(SETTINGS_STORE, SETTINGS_KEY),
    ]);
    return {
      profiles: profiles.map(toSummary),
      settings: settings
        ? {
            enabled: settings.enabled,
            activeConnectionId: settings.activeConnectionId,
            contextPermissions: { ...settings.contextPermissions },
          }
        : { ...DEFAULT_AI_SETTINGS, contextPermissions: { ...DEFAULT_AI_SETTINGS.contextPermissions } },
    };
  } finally {
    database.close();
  }
}

export async function createAiConnection(
  input: NovaAiConnectionInput,
): Promise<NovaAiConnectionSummary> {
  const profile: NovaAiConnectionProfile = {
    id: crypto.randomUUID(),
    ...normalizeProfileInput(input),
  };
  const database = await openAiConnectionDatabase();
  try {
    await database.add(PROFILE_STORE, profile);
    return toSummary(profile);
  } finally {
    database.close();
  }
}

export async function updateAiConnection(
  id: string,
  input: Omit<NovaAiConnectionInput, "apiKey"> & { apiKey?: string },
): Promise<NovaAiConnectionSummary> {
  const database = await openAiConnectionDatabase();
  try {
    const existing = await database.get(PROFILE_STORE, id);
    if (!existing) throw new Error("AI 连接配置不存在");
    const profile: NovaAiConnectionProfile = {
      id,
      ...normalizeProfileInput({
        ...input,
        apiKey: input.apiKey || existing.apiKey,
      }),
    };
    await database.put(PROFILE_STORE, profile);
    return toSummary(profile);
  } finally {
    database.close();
  }
}

export async function deleteAiConnection(id: string): Promise<void> {
  const database = await openAiConnectionDatabase();
  try {
    const transaction = database.transaction(
      [PROFILE_STORE, SETTINGS_STORE],
      "readwrite",
    );
    const settings = await transaction.objectStore(SETTINGS_STORE).get(SETTINGS_KEY);
    await transaction.objectStore(PROFILE_STORE).delete(id);
    if (settings?.activeConnectionId === id) {
      await transaction.objectStore(SETTINGS_STORE).put(toStoredSettings({
        enabled: settings.enabled,
        activeConnectionId: null,
        contextPermissions: settings.contextPermissions,
      }));
    }
    await transaction.done;
  } finally {
    database.close();
  }
}

export async function setActiveAiConnection(id: string | null): Promise<void> {
  const database = await openAiConnectionDatabase();
  try {
    const transaction = database.transaction(
      [PROFILE_STORE, SETTINGS_STORE],
      "readwrite",
    );
    if (id && !await transaction.objectStore(PROFILE_STORE).get(id)) {
      throw new Error("AI 连接配置不存在");
    }
    const current = await transaction.objectStore(SETTINGS_STORE).get(SETTINGS_KEY);
    await transaction.objectStore(SETTINGS_STORE).put(toStoredSettings({
      enabled: current?.enabled ?? DEFAULT_AI_SETTINGS.enabled,
      activeConnectionId: id,
      contextPermissions: current?.contextPermissions
        ?? { ...DEFAULT_AI_SETTINGS.contextPermissions },
    }));
    await transaction.done;
  } finally {
    database.close();
  }
}

export async function updateAiSettings(
  patch: Partial<Omit<NovaAiSettings, "activeConnectionId">>,
): Promise<void> {
  const database = await openAiConnectionDatabase();
  try {
    const current = await database.get(SETTINGS_STORE, SETTINGS_KEY);
    await database.put(SETTINGS_STORE, toStoredSettings({
      enabled: patch.enabled ?? current?.enabled ?? DEFAULT_AI_SETTINGS.enabled,
      activeConnectionId: current?.activeConnectionId ?? null,
      contextPermissions: {
        ...(current?.contextPermissions ?? DEFAULT_AI_SETTINGS.contextPermissions),
        ...patch.contextPermissions,
      },
    }));
  } finally {
    database.close();
  }
}

export async function getActiveAiConnection(): Promise<NovaAiConnectionProfile | null> {
  const database = await openAiConnectionDatabase();
  try {
    const settings = await database.get(SETTINGS_STORE, SETTINGS_KEY);
    if (!settings?.activeConnectionId) return null;
    return await database.get(PROFILE_STORE, settings.activeConnectionId) ?? null;
  } finally {
    database.close();
  }
}

export async function clearAiConnections(): Promise<void> {
  const database = await openAiConnectionDatabase();
  try {
    const transaction = database.transaction(
      [PROFILE_STORE, SETTINGS_STORE],
      "readwrite",
    );
    await Promise.all([
      transaction.objectStore(PROFILE_STORE).clear(),
      transaction.objectStore(SETTINGS_STORE).clear(),
    ]);
    await transaction.done;
  } finally {
    database.close();
  }
}
