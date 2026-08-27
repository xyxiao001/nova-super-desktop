import { createChapterIndex, decodeReaderBuffer } from "./readerCore";

type ReaderWorkerRequest =
  | { requestId: number; type: "decode"; buffer: ArrayBuffer }
  | { requestId: number; type: "parse"; content: string };

self.onmessage = (event: MessageEvent<ReaderWorkerRequest>) => {
  const { requestId } = event.data;
  try {
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
