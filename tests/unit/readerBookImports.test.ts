import { describe, expect, it } from "vitest";
import { chapterParagraphs, createChapterIndex, decodeReaderBuffer } from "../../src/apps/reader/readerCore";

describe("hosted novel formats", () => {
  it("decodes GB18030 text without requiring a UTF-8 copy", () => {
    // 第一章\n你好 — GB18030 bytes, independent of the hosted library.
    const bytes = Uint8Array.from([0xb5,0xda,0xd2,0xbb,0xd5,0xc2,0x0a,0xc4,0xe3,0xba,0xc3]);
    const parsed = createChapterIndex(decodeReaderBuffer(bytes.buffer));
    expect(parsed.chapters[0].title).toBe("第一章");
    expect(chapterParagraphs(parsed.content, parsed.chapters[0])[0].text).toBe("你好");
  });

  it("recognizes collection and chapter headings without absorbing the body", () => {
    const parsed = createChapterIndex("第一集 盘龙之戒 第一章 小镇的早晨\n第一段正文\n\n第二十一集 巅峰（结局卷） 第四十三章 新的名字（大结局）（下）\n最后的正文");
    expect(parsed.chapters.map(c=>parsed.content.slice(c.start,c.end))).toEqual(["第一段正文","最后的正文"]);
  });
});
