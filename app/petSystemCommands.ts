import type { WindowAppId } from "../src/platform/apps/appManifest";

export type PetSystemAction = {
  kind: "open-app";
  app: WindowAppId;
  label: string;
  execution?: "immediate";
};

export type PetSystemCommand = {
  id: string;
  patterns: readonly RegExp[];
  app: WindowAppId;
  label: string;
  reply: string;
};

export const PET_SYSTEM_COMMANDS: readonly PetSystemCommand[] = [
  { id: "gomoku", patterns: [/(?:我想|我要|想要|陪我|帮我|打开|启动|开始|来一局|玩|下).{0,6}五子棋/, /五子棋.{0,4}(?:打开|启动|开始|来一局|玩|下)$/], app: "gomoku", label: "打开五子棋", reply: "五子棋已经摆好，来一局吧。" },
  { id: "chess", patterns: [/(?:我想|我要|想要|陪我|帮我|打开|启动|开始|来一局|玩|下).{0,6}国际象棋/, /国际象棋.{0,4}(?:打开|启动|开始|来一局|玩|下)$/], app: "chess", label: "打开国际象棋", reply: "棋盘准备好了，慢慢想下一步。" },
  { id: "mines", patterns: [/(?:我想|我要|想要|陪我|帮我|打开|启动|开始|玩).{0,6}扫雷/, /扫雷.{0,4}(?:打开|启动|开始|来一局|玩)$/], app: "mines", label: "打开扫雷", reply: "扫雷已经打开，小心第一步。" },
  { id: "tower", patterns: [/(?:我想|我要|想要|打开|启动|开始|玩).{0,6}魔塔/], app: "tower", label: "打开魔塔", reply: "魔塔入口已经打开。" },
  { id: "youtd2", patterns: [/(?:我想|我要|想要|打开|启动|开始|玩).{0,6}(?:youtd ?2|塔防)/i], app: "youtd2", label: "打开 YouTD 2", reply: "塔防战场已经准备好了。" },
  { id: "wolfslot", patterns: [/(?:我想|我要|想要|打开|启动|开始|玩).{0,6}(?:童年老虎机|老虎机)/], app: "wolfslot", label: "打开童年老虎机", reply: "机台已经亮起来了。" },
  { id: "notes", patterns: [/(?:我想|我要|想要|帮我|打开|启动|开始|写|记).{0,8}(?:记事本|笔记|文稿|写.{0,4}(?:东西|文字))/, /(?:记事本|笔记|文稿).{0,4}(?:打开|启动|写|记录)$/], app: "notes", label: "打开记事本", reply: "记事本已经打开，趁想法还新鲜写下来吧。" },
  { id: "reader", patterns: [/(?:我想|我要|想要|陪我|帮我|打开|启动|开始|去).{0,8}(?:看书|读书|读.{0,5}书|阅读|书架)/, /(?:看书|读书|阅读|书架)(?:吧|打开|启动|开始|去)?$/], app: "reader", label: "打开 NOVA 阅读", reply: "阅读器已经打开，我陪你安静读一会儿。" },
  { id: "photo", patterns: [/(?:我想|我要|想要|帮我|打开|启动|开始).{0,8}(?:修图|编辑照片|照片实验室)/, /(?:修图|编辑照片|照片实验室)(?:吧|打开|启动|开始)?$/], app: "photo", label: "打开照片实验室", reply: "照片实验室已经打开，可以开始调整了。" },
  { id: "viewer", patterns: [/(?:我想|我要|想要|陪我|帮我|打开|启动|看看|看).{0,8}(?:照片|图片|相册)/, /(?:照片|图片|相册)(?:看看|打开|启动)?$/], app: "viewer", label: "打开照片", reply: "照片已经打开，一起看看吧。" },
  { id: "drawing", patterns: [/(?:我想|我要|想要|陪我|帮我|打开|启动|开始).{0,8}(?:画板|画画|绘画|涂鸦)/, /(?:画板|画画|绘画|涂鸦)(?:吧|打开|启动|开始)?$/], app: "drawing", label: "打开 NOVA 画板", reply: "画板已经铺好，尽管动笔吧。" },
  { id: "focus", patterns: [/(?:我想|我要|想要|陪我|帮我|打开|启动|开始).{0,8}(?:专注|集中|计时|番茄钟|专注时钟)/, /(?:专注|番茄钟|专注时钟)(?:吧|打开|启动|开始)?$/], app: "focus", label: "打开专注时钟", reply: "专注时钟已经打开，我会安静陪着你。" },
  { id: "explorer", patterns: [/(?:我想|我要|想要|帮我|打开|启动|开始|整理).{0,8}(?:文件|桌面文件|资源管理器)/, /(?:文件管理器|资源管理器)(?:打开|启动)?$/], app: "explorer", label: "打开文件资源管理器", reply: "文件资源管理器已经打开。" },
  { id: "calendar", patterns: [/(?:我想|我要|想要|打开|启动|看看|查看|进入).{0,6}(?:日历|日程|日期)/, /今天(?:是)?几号/, /(?:日历|日程)(?:打开|看看|查看)?$/], app: "calendar", label: "打开日历", reply: "日历已经打开，可以看看今天的安排。" },
  { id: "calculator", patterns: [/(?:打开|启动|使用|用|帮我|开始).{0,6}(?:计算器|计算)/, /(?:算一下|计算一下)/, /计算器(?:打开|启动)?$/], app: "calculator", label: "打开计算器", reply: "计算器已经打开，把数字交给它吧。" },
  { id: "settings", patterns: [/(?:打开|启动|进入|调出|看看|调整).{0,6}(?:系统)?设置/, /(?:系统)?设置(?:打开|启动|页面)?$/], app: "settings", label: "打开设置", reply: "系统设置已经打开。" },
  { id: "recycle", patterns: [/(?:打开|启动|进入|看看|查看).{0,6}回收站/, /回收站(?:打开|查看)?$/], app: "recycle", label: "打开回收站", reply: "回收站已经打开。" },
  { id: "games", patterns: [/(?:我想|我要|想要|陪我|帮我|打开|启动|开始|玩|放松).{0,8}(?:游戏|游戏大厅|下棋)/, /(?:陪我玩|我想玩|我要玩|想玩)(?:一会儿?)?$/, /游戏大厅(?:打开|启动)?$/], app: "games", label: "打开游戏大厅", reply: "游戏大厅已经打开，挑一个放松一下吧。" },
] as const;

export function matchPetSystemCommand(message: string) {
  const normalized = message.trim().slice(0, 120).replace(/[\s，。！？,.!?]/g, "");
  return PET_SYSTEM_COMMANDS.find(({ patterns }) => (
    patterns.some((pattern) => pattern.test(normalized))
  ));
}
