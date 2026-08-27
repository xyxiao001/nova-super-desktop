import { chapterParagraphs, createChapterIndex, decodeReaderBuffer, locationForOffset, type ReaderChapter, type ReaderSearchResult } from "./readerCore";

type ReaderWorkerRequest =
  | { requestId: number; type: "decode"; buffer: ArrayBuffer }
  | { requestId: number; type: "parse"; content: string }
  | { requestId: number; type: "search"; content: string; chapters: ReaderChapter[]; query: string };

self.onmessage = (event: MessageEvent<ReaderWorkerRequest>) => {
  const { requestId } = event.data;
  try {
    if (event.data.type === "search") {
      const query = event.data.query.trim().toLocaleLowerCase();
      const results: ReaderSearchResult[] = [];
      if (query) {
        for (const chapter of event.data.chapters) {
          const body = event.data.content.slice(chapter.start, chapter.end);
          const lowerBody = body.toLocaleLowerCase();
          const paragraphs = chapterParagraphs(event.data.content, chapter);
          let offset = lowerBody.indexOf(query);
          while (offset >= 0 && results.length < 100) {
            const location = locationForOffset(paragraphs, offset);
            const excerptStart = Math.max(0, offset - 28);
            const excerptEnd = Math.min(body.length, offset + query.length + 44);
            results.push({
              id: `${chapter.id}:${offset}`,
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              paragraphIndex: location.paragraphIndex,
              characterOffset: location.characterOffset,
              excerpt: body.slice(excerptStart, excerptEnd).replace(/\s+/g, " ").trim(),
            });
            offset = lowerBody.indexOf(query, offset + query.length);
          }
          if (results.length >= 100) break;
        }
      }
      self.postMessage({ requestId, results });
      return;
    }
    const input = event.data.type === "decode"
      ? decodeReaderBuffer(event.data.buffer)
      : event.data.content;
    const result = createChapterIndex(input);
    self.postMessage({ requestId, ...result });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "书籍解析失败",
    });
  }
};
