import type { PetMood, PetPersonality } from "./petModel";
import {
  matchPetSystemCommand,
  type PetSystemAction,
} from "./petSystemCommands";

export type PetDialogueAction = PetSystemAction;

export type PetDialogueReply = {
  text: string;
  action?: PetDialogueAction;
};

export type PetDialogueContext = {
  name: string;
  personality: PetPersonality;
  mood: PetMood;
  energy: number;
};

const MOOD_LABELS: Record<PetMood, string> = {
  calm: "很平静",
  happy: "很开心",
  excited: "有点兴奋",
  sleepy: "有些困了",
  curious: "正好奇着",
};

const FALLBACK_REPLIES: Record<PetPersonality, string> = {
  quiet: "我听见了。要不要先安静地做一件小事？",
  curious: "这个我还不太懂，不过我愿意陪你找找桌面上能做的事。",
  lively: "好呀。你也可以叫我打开应用，或者问问我的状态。",
};

export function createLocalPetReply(
  message: string,
  context: PetDialogueContext,
): PetDialogueReply {
  const normalized = message.trim().slice(0, 120);
  const command = matchPetSystemCommand(normalized);
  if (command) {
    return {
      text: command.reply,
      action: {
        kind: "open-app",
        app: command.app,
        label: command.label,
        execution: "immediate",
      },
    };
  }

  if (/你好|嗨|早上好|中午好|晚上好|在吗/.test(normalized)) {
    return { text: `我在，${context.name}会陪你在桌面上慢慢做事。` };
  }
  if (/心情|感觉|开心吗|怎么样/.test(normalized)) {
    return { text: `我现在${MOOD_LABELS[context.mood]}。` };
  }
  if (/精力|累不累|困不困/.test(normalized)) {
    if (context.energy <= 20) return { text: "我的精力不多了，想在桌面角落休息一会儿。" };
    if (context.energy >= 70) return { text: "我精力很足，可以陪你继续做事。" };
    return { text: "我的精力还不错，适合做一件不太长的事。" };
  }
  if (/会什么|能做什么|帮助|帮我|功能/.test(normalized)) {
    return { text: "我能陪你聊天，也能带你去记事、阅读、看照片、画画、专注、整理文件或放松。" };
  }
  if (/谢谢|谢了|感谢/.test(normalized)) {
    return { text: "不用客气，我就在桌面上。" };
  }
  return { text: FALLBACK_REPLIES[context.personality] };
}
