import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chapterParagraphs, createChapterIndex, decodeReaderBuffer } from "../../src/apps/reader/readerCore";

const books = [
  { file:"global-martial-arts", first:"第一章 剧本不对", last:"第1432章 三界新生，有缘再会（大结局）", opening:"2008年，4月5日。" },
  { file:"lord-of-the-mysteries", first:"第一章 绯红", last:"第四十一章 新的旅程", opening:"痛！" },
  { file:"coiling-dragon", first:"第一集 盘龙之戒 第一章 小镇的早晨", last:"第二十一集 巅峰（结局卷） 第四十三章 新的名字（大结局）（下）", opening:"乌山镇" },
];

describe("new hosted novels", () => {
  it.each(books)("decodes and indexes $file for reading before upload", ({file,first,last,opening}) => {
    const bytes = readFileSync(`public/books/${file}.txt`);
    expect(bytes.byteLength).toBeLessThanOrEqual(25 * 1024 * 1024);
    const buffer = new Uint8Array(bytes).buffer;
    const text = decodeReaderBuffer(buffer);
    expect(text).not.toContain("\uFFFD");
    const parsed = createChapterIndex(text);
    expect(parsed.chapters[1].title).toBe(first);
    expect(parsed.chapters.at(-1)?.title).toBe(last);
    expect(chapterParagraphs(parsed.content,parsed.chapters[1])[0].text).toContain(opening);
    for(const chapter of parsed.chapters) {
      const paragraphs = chapterParagraphs(parsed.content,chapter);
      expect(paragraphs.length).toBeGreaterThan(0);
      expect(chapter.end).toBeGreaterThan(chapter.start);
      expect(chapter.end).toBeLessThanOrEqual(parsed.content.length);
      expect(paragraphs.map(p=>p.text).join("")).not.toContain("\uFFFD");
    }
  });

  it("recognizes collection and chapter headings without absorbing the body", () => {
    const parsed = createChapterIndex("第一集 盘龙之戒 第一章 小镇的早晨\n第一段正文\n\n第二十一集 巅峰（结局卷） 第四十三章 新的名字（大结局）（下）\n最后的正文");
    expect(parsed.chapters.map(c=>parsed.content.slice(c.start,c.end))).toEqual(["第一段正文","最后的正文"]);
  });
});
