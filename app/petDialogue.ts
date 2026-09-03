import type { PetMood, PetPersonality } from "./petModel";
import type { WindowAppId } from "../src/platform/apps/appManifest";

export type PetDialogueAction = {
  kind: "open-app";
  app: WindowAppId;
  label: string;
};

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

type AppIntent = {
  pattern: RegExp;
  app: WindowAppId;
  label: string;
  reply: string;
};

const APP_INTENTS: readonly AppIntent[] = [
  { pattern: /记事本|笔记|写(点|些|一会|东西|文字)|文稿/, app: "notes", label: "打开记事本", reply: "想法值得马上记下来。" },
  { pattern: /阅读|读书|读.*书|陪.*读|看书|书架/, app: "reader", label: "打开 NOVA 阅读", reply: "找个舒服的位置，读一会儿吧。" },
  { pattern: /照片|图片|相册/, app: "viewer", label: "打开照片", reply: "一起看看桌面里的照片吧。" },
  { pattern: /画板|画画|绘画|涂鸦/, app: "drawing", label: "打开 NOVA 画板", reply: "画点什么会让今天更有意思。" },
  { pattern: /专注|番茄|计时|集中/, app: "focus", label: "打开专注时钟", reply: "我会安静陪你完成这一段专注。" },
  { pattern: /文件|整理|资源管理器/, app: "explorer", label: "打开文件资源管理器", reply: "我们去把桌面和文件整理清楚。" },
  { pattern: /日历|日期|几号|安排|日程/, app: "calendar", label: "打开日历", reply: "日历里能看清今天和接下来的安排。" },
  { pattern: /游戏|陪.*玩|放松|摸鱼|下棋|扫雷/, app: "games", label: "打开游戏大厅", reply: "休息一会儿也很重要。" },
  { pattern: /计算|算一下|计算器/, app: "calculator", label: "打开计算器", reply: "把数字交给计算器会更快。" },
  { pattern: /设置|配置|选项/, app: "settings", label: "打开设置", reply: "可以在设置里调整桌面和我的状态。" },
] as const;

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
  const appIntent = APP_INTENTS.find(({ pattern }) => pattern.test(normalized));
  if (appIntent) {
    return {
      text: appIntent.reply,
      action: {
        kind: "open-app",
        app: appIntent.app,
        label: appIntent.label,
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
