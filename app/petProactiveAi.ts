import type { NovaAiConnectionProfile } from "./aiConnectionStorage";
import {
  requestOpenAiCompletion,
  type NovaAiMessage,
  type NovaAiRequestOptions,
} from "./petAi";
import type { PetAmbientActivity } from "./petAmbient";
import type { PetMood, PetPersonality } from "./petModel";

export const PROACTIVE_AI_MAX_TOKENS = 48;
export const PROACTIVE_AI_TIMEOUT_MS = 5_000;
export const PROACTIVE_AI_COOLDOWN_MS = 30 * 60_000;
export const PROACTIVE_AI_MAX_REQUESTS_PER_SESSION = 2;

export type PetProactiveAiContext = {
  petName: string;
  personality: PetPersonality;
  mood: PetMood;
  activity: PetAmbientActivity;
};

const ACTIVITY_LABELS: Record<PetAmbientActivity, string> = {
  rest: "躺着休息",
  groom: "洗脸整理胡须",
  bathe: "泡澡",
  stretch: "伸懒腰",
};

export function canRequestProactiveAi({
  requestCount,
  lastRequestAt,
  now,
}: {
  requestCount: number;
  lastRequestAt: number | null;
  now: number;
}) {
  return requestCount < PROACTIVE_AI_MAX_REQUESTS_PER_SESSION
    && (
      lastRequestAt === null
      || now - lastRequestAt >= PROACTIVE_AI_COOLDOWN_MS
    );
}

export function buildPetProactiveAiMessages(
  context: PetProactiveAiContext,
): NovaAiMessage[] {
  return [
    {
      role: "system",
      content: [
        `你是 NOVA 桌面猫${context.petName}，性格${context.personality}，心情${context.mood}。`,
        `你正在${ACTIVITY_LABELS[context.activity]}。`,
        "只输出一句自然的中文自言自语，8到24个汉字。",
        "不要使用 Markdown，不提 AI，不声称执行了操作，不询问隐私。",
      ].join("\n"),
    },
    {
      role: "user",
      content: "说一句此刻适合的桌面陪伴短句。",
    },
  ];
}

export function normalizePetProactiveAiLine(content: string) {
  return content.trim().replace(/\s+/g, " ").slice(0, 48);
}

export async function requestPetProactiveAiLine(
  profile: NovaAiConnectionProfile,
  context: PetProactiveAiContext,
  options: Pick<NovaAiRequestOptions, "fetcher" | "signal"> = {},
) {
  const completion = await requestOpenAiCompletion(
    profile,
    buildPetProactiveAiMessages(context),
    {
      ...options,
      allowWebSearch: false,
      maxTokens: PROACTIVE_AI_MAX_TOKENS,
      timeoutMs: PROACTIVE_AI_TIMEOUT_MS,
    },
  );
  return normalizePetProactiveAiLine(completion.content);
}
