import type {
  PetBubbleFrequency,
  PetPersonality,
} from "./petModel";

export type PetAmbientActivity = "rest" | "groom" | "bathe" | "stretch";

export type PetAmbientMoment = {
  activity: PetAmbientActivity;
  text: string;
};

export const PET_AMBIENT_IDLE_MS: Record<PetBubbleFrequency, number> = {
  low: 120_000,
  medium: 60_000,
  high: 35_000,
};

const AMBIENT_MOMENTS: readonly PetAmbientMoment[] = [
  { activity: "rest", text: "桌面好安静，我先躺一会儿。" },
  { activity: "groom", text: "把胡须理整齐，再陪你做事。" },
  { activity: "stretch", text: "伸个懒腰，接下来做什么呢？" },
  { activity: "bathe", text: "泡泡刚刚好，我洗得香香的。" },
] as const;

const PERSONALITY_OFFSET: Record<PetPersonality, number> = {
  quiet: 0,
  curious: 1,
  lively: 2,
};

export function createPetAmbientMoment({
  sequence,
  personality,
  visibleItemCount,
  hour,
}: {
  sequence: number;
  personality: PetPersonality;
  visibleItemCount: number;
  hour: number;
}): PetAmbientMoment {
  if (visibleItemCount >= 12 && sequence % 5 === 4) {
    return {
      activity: "stretch",
      text: "桌面有点热闹，要不要找时间整理一下？",
    };
  }
  if ((hour >= 23 || hour < 6) && sequence % 4 === 0) {
    return {
      activity: "rest",
      text: "夜深啦，我陪你把手头这点做完。",
    };
  }
  const index = (
    Math.max(0, sequence) + PERSONALITY_OFFSET[personality]
  ) % AMBIENT_MOMENTS.length;
  return AMBIENT_MOMENTS[index];
}
