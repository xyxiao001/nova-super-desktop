import { describe, expect, it } from "vitest";

import {
  chapterParagraphs,
  createChapterIndex,
  decodeReaderBuffer,
  locationForOffset,
  normalizeReaderText,
  readerExcerpt,
  type ReaderChapter,
} from "../../src/apps/reader/readerCore";

describe("readerCore", () => {
  it("normalizes BOM and Windows line endings", () => {
    expect(normalizeReaderText("\uFEFFfirst\r\nsecond\rlast")).toBe(
      "first\nsecond\nlast",
    );
  });

  it("formats a selected passage with its book and chapter source", () => {
    expect(readerExcerpt("围城", "第一章", "  一段文字  ")).toEqual({
      title: "围城 摘录",
      content: "一段文字\n\n摘自《围城》 · 第一章",
    });
  });

  it("indexes opening text and chapter bodies without copying titles into content", () => {
    const input = "作品说明\n\n第一章\n第一段\n第二段\n\n第二章\n结尾";
    const result = createChapterIndex(input);

    expect(result.chapters.map((chapter) => chapter.title)).toEqual([
      "开始",
      "第一章",
      "第二章",
    ]);
    expect(
      result.chapters.map((chapter) =>
        result.content.slice(chapter.start, chapter.end),
      ),
    ).toEqual(["作品说明", "第一段\n第二段", "结尾"]);
    expect(result.chapters[1]).toMatchObject({
      characterCount: 7,
      paragraphCount: 2,
    });
  });

  it("creates a full-text fallback chapter for empty and heading-free input", () => {
    expect(createChapterIndex("").chapters).toEqual([
      expect.objectContaining({
        id: "chapter:0",
        title: "全文",
        characterCount: 0,
        paragraphCount: 0,
      }),
    ]);
    expect(createChapterIndex("plain text").chapters[0]).toMatchObject({
      title: "全文",
      characterCount: 10,
      paragraphCount: 1,
    });
  });

  it("decodes UTF-8 BOM, UTF-16 LE/BE, and GB18030 input", () => {
    expect(
      decodeReaderBuffer(
        new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x0d, 0x0a, 0x42]).buffer,
      ),
    ).toBe("A\nB");
    expect(
      decodeReaderBuffer(
        new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x0d, 0x00, 0x0a, 0x00, 0x42, 0x00]).buffer,
      ),
    ).toBe("A\nB");
    expect(
      decodeReaderBuffer(
        new Uint8Array([0xfe, 0xff, 0x00, 0x41, 0x00, 0x0d, 0x00, 0x0a, 0x00, 0x42]).buffer,
      ),
    ).toBe("A\nB");
    expect(
      decodeReaderBuffer(new Uint8Array([0xc4, 0xe3, 0xba, 0xc3]).buffer),
    ).toBe("你好");
  });

  it("maps chapter-relative offsets to trimmed paragraphs", () => {
    const content = "  Alpha  \n\n Beta";
    const chapter: ReaderChapter = {
      id: "chapter:0",
      title: "全文",
      start: 0,
      end: content.length,
      characterCount: content.length,
      paragraphCount: 2,
    };
    const paragraphs = chapterParagraphs(content, chapter);

    expect(paragraphs).toEqual([
      { index: 0, text: "Alpha", start: 2, end: 7 },
      { index: 1, text: "Beta", start: 12, end: 16 },
    ]);
    expect(locationForOffset(paragraphs, -10)).toEqual({
      paragraphIndex: 0,
      characterOffset: 0,
    });
    expect(locationForOffset(paragraphs, 12)).toEqual({
      paragraphIndex: 1,
      characterOffset: 0,
    });
    expect(locationForOffset(paragraphs, 100)).toEqual({
      paragraphIndex: 1,
      characterOffset: 4,
    });
  });
});
