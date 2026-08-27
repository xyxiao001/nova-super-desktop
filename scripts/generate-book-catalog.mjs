import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const booksDirectory = path.resolve("public/books");
const curated = {
  "rich-dad-poor-dad.txt": {
    id: "rich-dad-poor-dad",
    title: "穷爸爸富爸爸",
    author: "罗伯特·T·清崎",
    description: "从两种截然不同的金钱观出发，重新理解资产、负债与财务选择。",
    cover: "amber",
  },
  "fortress-besieged.txt": {
    id: "fortress-besieged",
    title: "围城",
    author: "钱钟书",
    description: "在机锋与讽刺之间，观察婚姻、知识分子与人生困局。",
    cover: "jade",
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
