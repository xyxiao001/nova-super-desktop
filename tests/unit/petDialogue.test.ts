import { describe, expect, it } from "vitest";

import { createLocalPetReply } from "../../app/petDialogue";

const context = {
  name: "Nova",
  personality: "curious" as const,
  mood: "happy" as const,
  energy: 72,
};

describe("local pet dialogue", () => {
  it.each([
    ["帮我打开记事本", "notes", "打开记事本"],
    ["我想读一会儿书", "reader", "打开 NOVA 阅读"],
    ["看看照片", "viewer", "打开照片"],
    ["打开画板画画", "drawing", "打开 NOVA 画板"],
    ["开始专注", "focus", "打开专注时钟"],
    ["整理一下文件", "explorer", "打开文件资源管理器"],
    ["今天几号", "calendar", "打开日历"],
    ["玩会儿游戏", "games", "打开游戏大厅"],
    ["算一下数字", "calculator", "打开计算器"],
    ["调整设置", "settings", "打开设置"],
  ] as const)("returns an explicit app action for %s", (message, app, label) => {
    const reply = createLocalPetReply(message, context);

    expect(reply.action).toEqual({
      kind: "open-app",
      app,
      label,
    });
    expect(reply.text.length).toBeGreaterThan(0);
  });

  it("answers pet state questions without producing an action", () => {
    expect(createLocalPetReply("你心情怎么样", context)).toEqual({
      text: "我现在很开心。",
    });
    expect(createLocalPetReply("你累不累", {
      ...context,
      energy: 12,
    })).toEqual({
      text: "我的精力不多了，想在桌面角落休息一会儿。",
    });
  });

  it("lists local capabilities without requiring AI", () => {
    const reply = createLocalPetReply("你会什么功能", context);

    expect(reply.action).toBeUndefined();
    expect(reply.text).toContain("记事");
    expect(reply.text).toContain("整理文件");
  });

  it("uses personality-specific fallback without echoing arbitrary input", () => {
    const input = "这是一段没有对应意图的任意内容";
    const reply = createLocalPetReply(input, {
      ...context,
      personality: "quiet",
    });

    expect(reply).toEqual({
      text: "我听见了。要不要先安静地做一件小事？",
    });
    expect(reply.text).not.toContain(input);
  });
});
