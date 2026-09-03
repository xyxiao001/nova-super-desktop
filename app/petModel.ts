import type {
  NovaActivityEvent,
  NovaActivityEventType,
} from "./activityEvents";

export type PetPersonality = "quiet" | "curious" | "lively";
export type PetMood = "calm" | "happy" | "excited" | "sleepy" | "curious";
export type PetActivity =
  | "idle"
  | "walk"
  | "read"
  | "draw"
  | "focus"
  | "celebrate"
  | "comfort"
  | "nuzzle"
  | "pounce"
  | "sleep";
export type PetMotionIntensity = "static" | "gentle" | "active";
export type PetBubbleFrequency = "low" | "medium" | "high";

export type PetProfile = {
  id: string;
  name: string;
  species: "nova-cat";
  personality: PetPersonality;
  createdAt: number;
};

export type PetState = {
  mood: PetMood;
  energy: number;
  affinity: number;
  activity: PetActivity;
  x: number;
  y: number;
  hidden: boolean;
  lastActiveAt: number;
  lastReactionAt: Partial<Record<NovaActivityEventType, number>>;
};

export type PetMemory = {
  eventCounts: Partial<Record<NovaActivityEventType, number>>;
  firstOccurredAt: Partial<Record<NovaActivityEventType, number>>;
  readingMilestones: Record<string, 25 | 50 | 75 | 100>;
  discoveries: string[];
};

export type PetPreferences = {
  enabled: boolean;
  motion: PetMotionIntensity;
  sound: boolean;
  bubbleFrequency: PetBubbleFrequency;
};

export type PetData = {
  profile: PetProfile;
  state: PetState;
  memory: PetMemory;
  preferences: PetPreferences;
};

export const PET_VALUE_MIN = 0;
export const PET_VALUE_MAX = 100;
export const PET_IDLE_RESET_MS = 30 * 60 * 1000;
export const DEFAULT_PET_POSITION = { x: 0.82, y: 0.78 } as const;

export const PET_REACTION_COOLDOWN_MS: Record<NovaActivityEventType, number> = {
  "app-activated": 30_000,
  "file-created": 45_000,
  "files-organized": 60_000,
  "creative-saved": 60_000,
  "reading-started": 5 * 60_000,
  "reading-milestone": 60_000,
  "excerpt-created": 60_000,
  "note-created": 60_000,
  "focus-started": 0,
  "focus-ended": 0,
  "focus-completed": 60_000,
  "pet-interacted": 800,
  "game-finished": 60_000,
  "wallpaper-changed": 60_000,
};

type PetReaction = {
  mood: PetMood;
  activity: PetActivity;
  energyDelta: number;
  affinityDelta: number;
};

const BASE_REACTIONS: Record<NovaActivityEventType, PetReaction> = {
  "app-activated": { mood: "curious", activity: "idle", energyDelta: -1, affinityDelta: 0 },
  "file-created": { mood: "curious", activity: "walk", energyDelta: -1, affinityDelta: 1 },
  "files-organized": { mood: "happy", activity: "walk", energyDelta: -2, affinityDelta: 2 },
  "creative-saved": { mood: "excited", activity: "draw", energyDelta: -2, affinityDelta: 2 },
  "reading-started": { mood: "calm", activity: "read", energyDelta: -1, affinityDelta: 1 },
  "reading-milestone": { mood: "happy", activity: "read", energyDelta: -1, affinityDelta: 2 },
  "excerpt-created": { mood: "curious", activity: "read", energyDelta: -1, affinityDelta: 1 },
  "note-created": { mood: "curious", activity: "draw", energyDelta: -1, affinityDelta: 1 },
  "focus-started": { mood: "calm", activity: "focus", energyDelta: 0, affinityDelta: 0 },
  "focus-ended": { mood: "calm", activity: "idle", energyDelta: 0, affinityDelta: 0 },
  "focus-completed": { mood: "happy", activity: "celebrate", energyDelta: -2, affinityDelta: 3 },
  "pet-interacted": { mood: "happy", activity: "nuzzle", energyDelta: 0, affinityDelta: 1 },
  "game-finished": { mood: "curious", activity: "idle", energyDelta: -2, affinityDelta: 1 },
  "wallpaper-changed": { mood: "curious", activity: "idle", energyDelta: -1, affinityDelta: 0 },
};

const clampPetValue = (value: number) => (
  Math.min(PET_VALUE_MAX, Math.max(PET_VALUE_MIN, value))
);

const reactionFor = (event: NovaActivityEvent): PetReaction => {
  if (event.type === "pet-interacted") {
    if (event.payload?.interaction === "high-five") {
      return { mood: "excited", activity: "celebrate", energyDelta: -1, affinityDelta: 1 };
    }
    if (event.payload?.interaction === "play") {
      return { mood: "curious", activity: "pounce", energyDelta: -2, affinityDelta: 1 };
    }
  }
  if (event.type === "game-finished") {
    if (event.payload?.outcome === "win") {
      return { mood: "excited", activity: "celebrate", energyDelta: -2, affinityDelta: 2 };
    }
    if (event.payload?.outcome === "loss") {
      return { mood: "calm", activity: "comfort", energyDelta: -1, affinityDelta: 1 };
    }
  }
  return BASE_REACTIONS[event.type];
};

const discoveryFor = (event: NovaActivityEvent) => {
  if (event.type === "creative-saved") return "first-creation";
  if (event.type === "focus-completed") return "first-focus";
  if (event.type === "reading-milestone" && event.payload?.progressBucket === 100) {
    return "first-book-completed";
  }
  if (event.type === "game-finished" && event.payload?.outcome === "win") {
    return "first-game-win";
  }
  return null;
};

export const petActivityFeedback = (event: NovaActivityEvent) => {
  if (event.type === "creative-saved") {
    return event.source === "photo"
      ? "照片收好啦，这个光影真好看！"
      : "新作品保存好啦，我很喜欢！";
  }
  if (event.type === "reading-milestone") {
    const progress = event.payload?.progressBucket;
    if (progress === 100) return "读完啦，合上书休息一下吧。";
    if (progress === 75) return "已经读到四分之三啦。";
    if (progress === 50) return "读到一半啦，我继续陪你。";
    if (progress === 25) return "读完四分之一啦，慢慢来。";
  }
  if (event.type === "focus-completed") {
    return event.payload?.durationBucket === "long"
      ? "完成了一次长专注，辛苦啦！"
      : "专注完成，做得很好！";
  }
  if (event.type === "pet-interacted") {
    if (event.payload?.interaction === "high-five") return "啪！默契满分。";
    if (event.payload?.interaction === "play") return "抓到啦！再来一次？";
    return "呼噜呼噜，再摸一下也可以。";
  }
  return null;
};

export const createPetData = ({
  name,
  personality,
  id = crypto.randomUUID(),
  now = Date.now(),
}: {
  name: string;
  personality: PetPersonality;
  id?: string;
  now?: number;
}): PetData => ({
  profile: {
    id,
    name: name.trim(),
    species: "nova-cat",
    personality,
    createdAt: now,
  },
  state: {
    mood: "calm",
    energy: 72,
    affinity: 0,
    activity: "idle",
    x: DEFAULT_PET_POSITION.x,
    y: DEFAULT_PET_POSITION.y,
    hidden: false,
    lastActiveAt: now,
    lastReactionAt: {},
  },
  memory: {
    eventCounts: {},
    firstOccurredAt: {},
    readingMilestones: {},
    discoveries: [],
  },
  preferences: {
    enabled: true,
    motion: "gentle",
    sound: true,
    bubbleFrequency: "medium",
  },
});

export const reducePetState = (
  state: PetState,
  event: NovaActivityEvent,
): PetState => {
  const previousReactionAt = state.lastReactionAt[event.type];
  const inCooldown = previousReactionAt !== undefined
    && event.occurredAt - previousReactionAt < PET_REACTION_COOLDOWN_MS[event.type];
  if (inCooldown) {
    return {
      ...state,
      lastActiveAt: Math.max(state.lastActiveAt, event.occurredAt),
    };
  }

  const reaction = reactionFor(event);
  const energy = clampPetValue(state.energy + reaction.energyDelta);
  return {
    ...state,
    mood: energy <= 12 ? "sleepy" : reaction.mood,
    energy,
    affinity: clampPetValue(state.affinity + reaction.affinityDelta),
    activity: energy <= 12 ? "sleep" : reaction.activity,
    lastActiveAt: Math.max(state.lastActiveAt, event.occurredAt),
    lastReactionAt: {
      ...state.lastReactionAt,
      [event.type]: event.occurredAt,
    },
  };
};

export const reducePetMemory = (
  memory: PetMemory,
  event: NovaActivityEvent,
): PetMemory => {
  const previousCount = memory.eventCounts[event.type] ?? 0;
  const firstOccurredAt = memory.firstOccurredAt[event.type] === undefined
    ? { ...memory.firstOccurredAt, [event.type]: event.occurredAt }
    : memory.firstOccurredAt;
  const readingMilestones = event.type === "reading-milestone"
    && event.payload?.localResourceId
    && event.payload.progressBucket
    ? {
        ...memory.readingMilestones,
        [event.payload.localResourceId]: Math.max(
          memory.readingMilestones[event.payload.localResourceId] ?? 0,
          event.payload.progressBucket,
        ) as 25 | 50 | 75 | 100,
      }
    : memory.readingMilestones;
  const discovery = discoveryFor(event);
  const discoveries = discovery && !memory.discoveries.includes(discovery)
    ? [...memory.discoveries, discovery]
    : memory.discoveries;

  return {
    eventCounts: {
      ...memory.eventCounts,
      [event.type]: previousCount + 1,
    },
    firstOccurredAt,
    readingMilestones,
    discoveries,
  };
};

export const reducePetData = (
  data: PetData,
  event: NovaActivityEvent,
): PetData => ({
  ...data,
  state: reducePetState(data.state, event),
  memory: reducePetMemory(data.memory, event),
});

export const restorePetState = (
  state: PetState,
  now = Date.now(),
): PetState => now - state.lastActiveAt < PET_IDLE_RESET_MS ? state : {
  ...state,
  mood: "calm",
  activity: "idle",
  lastActiveAt: now,
};
