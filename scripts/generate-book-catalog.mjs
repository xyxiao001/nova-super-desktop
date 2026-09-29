import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const booksDirectory = path.resolve("public/books");
const curated = {
  "global-martial-arts.txt": {
    id: "global-martial-arts",
    title: "全球高武",
    author: "老鹰吃小鸡",
    description: "地窟入侵、武道崛起，方平为生存与守护踏上武道之路。",
    cover: "amber",
  },
  "lord-of-the-mysteries.txt": {
    id: "lord-of-the-mysteries",
    title: "诡秘之主",
    author: "爱潜水的乌贼",
    description: "在蒸汽机械与非凡力量交织的世界中，揭开历史与命运的迷雾。",
    cover: "slate",
  },
  "coiling-dragon.txt": {
    id: "coiling-dragon",
    title: "盘龙",
    author: "我吃西红柿",
    description: "少年林雷从乌山镇出发，在魔法与斗气的世界中追寻强者之路。",
    cover: "jade",
  },
  "xian-ni.txt": {
    id: "xian-ni",
    title: "仙逆",
    author: "耳根",
    description: "平凡少年王林踏入修真世界，逆境求道的仙侠长篇。",
    cover: "slate",
  },
  "three-body.txt": {
    id: "three-body",
    title: "三体",
    author: "刘慈欣",
    description: "跨越地球往事、黑暗森林与死神永生的科幻三部曲。",
    cover: "indigo",
  },
  "journey-under-the-midnight-sun.txt": {
    id: "journey-under-the-midnight-sun",
    title: "白夜行",
    author: "东野圭吾",
    description: "围绕一桩旧案展开，在漫长岁月中追索人物命运与真相。",
    cover: "slate",
  },
  "yang-shen.txt": {
    id: "yang-shen",
    title: "阳神",
    author: "梦入神机",
    description: "以肉身与神魂修行为主线展开的东方玄幻长篇。",
    cover: "amber",
  },
  "rich-dad-poor-dad.txt": {
    id: "rich-dad-poor-dad",
    title: "穷爸爸富爸爸",
    author: "罗伯特·T·清崎",
    description: "从两种截然不同的金钱观出发，重新理解资产、负债与财务选择。",
    cover: "amber",
  },
  "strongest-sect.txt": {
    id: "strongest-sect",
    title: "万古最强宗",
    author: "江湖再见",
    description: "宗门养成、热血冒险与轻松日常交织的长篇故事。",
    cover: "indigo",
  },
};

const files = (await readdir(booksDirectory)).filter((name) => name.endsWith(".txt")).sort();
const books = await Promise.all(files.map(async (file) => {
  const metadata = curated[file] ?? {
    id: file.replace(/\.txt$/i, "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-"),
    title: file.replace(/\.txt$/i, ""),
    author: "未知作者",
    description: "云端 TXT 书籍",
    cover: "slate",
  };
  const [content, info] = await Promise.all([readFile(path.join(booksDirectory, file)), stat(path.join(booksDirectory, file))]);
  return {
    ...metadata,
    file,
    url: `/books/${encodeURIComponent(file)}`,
    size: info.size,
    version: createHash("sha256").update(content).digest("hex").slice(0, 12),
  };
}));

await writeFile(path.join(booksDirectory, "catalog.json"), `${JSON.stringify({ books }, null, 2)}\n`);
