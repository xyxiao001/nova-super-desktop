import { beforeEach, describe, expect, it, vi } from "vitest";

import { createChapterIndex } from "../../app/readerCore";

type WorkerScope = {
  onmessage?: (event: MessageEvent) => void;
  postMessage: ReturnType<typeof vi.fn>;
};

async function createWorkerScope() {
  const scope: WorkerScope = {
    postMessage: vi.fn(),
  };
  vi.stubGlobal("self", scope);
  vi.resetModules();
  await import("../../app/reader.worker");
  return scope;
}

describe("reader.worker search", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds case-insensitive matches with semantic paragraph locations", async () => {
    const scope = await createWorkerScope();
    const { content, chapters } = createChapterIndex(
      "第一章\nAlpha Needle omega\nSecond line\n第二章\nneedle again",
    );

    scope.onmessage?.({
      data: {
        requestId: 7,
        type: "search",
        content,
        chapters,
        query: "NEEDLE",
      },
    } as MessageEvent);

    expect(scope.postMessage).toHaveBeenCalledOnce();
    expect(scope.postMessage).toHaveBeenCalledWith({
      requestId: 7,
      results: [
        expect.objectContaining({
          chapterTitle: "第一章",
          paragraphIndex: 0,
          characterOffset: 6,
        }),
        expect.objectContaining({
          chapterTitle: "第二章",
          paragraphIndex: 0,
          characterOffset: 0,
        }),
      ],
    });
  });

  it("returns no results for a whitespace-only query", async () => {
    const scope = await createWorkerScope();
    const { content, chapters } = createChapterIndex("needle");

    scope.onmessage?.({
      data: {
        requestId: 8,
        type: "search",
        content,
        chapters,
        query: "   ",
      },
    } as MessageEvent);

    expect(scope.postMessage).toHaveBeenCalledWith({
      requestId: 8,
      results: [],
    });
  });

  it("caps search results at 100 matches", async () => {
    const scope = await createWorkerScope();
    const { content, chapters } = createChapterIndex(
      Array.from({ length: 120 }, () => "needle").join(" "),
    );

    scope.onmessage?.({
      data: {
        requestId: 9,
        type: "search",
        content,
        chapters,
        query: "needle",
      },
    } as MessageEvent);

    expect(scope.postMessage).toHaveBeenCalledWith({
      requestId: 9,
      results: expect.any(Array),
    });
    expect(scope.postMessage.mock.calls[0][0].results).toHaveLength(100);
  });

  it("keeps decode and chapter parsing responses correlated by request id", async () => {
    const scope = await createWorkerScope();

    scope.onmessage?.({
      data: {
        requestId: 10,
        type: "decode",
        buffer: new TextEncoder().encode("第一章\r\n正文").buffer,
      },
    } as MessageEvent);

    expect(scope.postMessage).toHaveBeenCalledWith({
      requestId: 10,
      content: "第一章\n正文",
      chapters: [
        expect.objectContaining({
          title: "第一章",
          characterCount: 2,
        }),
      ],
    });
  });
});
