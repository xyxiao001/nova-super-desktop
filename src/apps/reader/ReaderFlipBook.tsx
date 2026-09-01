"use client";

import { forwardRef, useMemo, useRef, type CSSProperties } from "react";
import HTMLFlipBook from "react-pageflip-enhanced";

type FlipEngine = {
  flipNext: (corner?: "top" | "bottom") => void;
  flipPrev: (corner?: "top" | "bottom") => void;
};

type ReaderFlipBookProps = {
  title: string;
  author: string;
  chapterTitle: string;
  paragraphs: Array<{ index: number; text: string }>;
  pageIndex: number;
  pageCount: number;
  totalProgress: number;
  pageWidth: number;
  pageHeight: number;
  flowPageWidth: number;
  pageGap: number;
  fontSize: number;
  lineHeight: number;
  nextChapter: {
    title: string;
    paragraphs: Array<{ index: number; text: string }>;
  } | null;
  onPageChange: (pageIndex: number) => void;
  onBoundaryPrevious: () => void;
  onBoundaryNext: () => void;
};

type FlipSlot =
  | { type: "page"; pageIndex: number }
  | { type: "nextChapter"; title: string; paragraphs: Array<{ index: number; text: string }> };

type PendingTurn =
  | { type: "page"; pageIndex: number }
  | { type: "nextChapter" };

const FlipPage = forwardRef<HTMLDivElement, ReaderFlipBookProps & { targetPage: number; pageLabel?: string }>(
  function FlipPage({ title, author, chapterTitle, paragraphs, pageCount, totalProgress, flowPageWidth, pageGap, fontSize, lineHeight, targetPage, pageLabel }, ref) {
    return <div className="reader-flip-sheet" ref={ref}>
      <article className="reader-page reader-flip-page" style={{ "--reader-font-size": `${fontSize}px`, lineHeight } as CSSProperties}>
        <header><span>{title}</span><span>{chapterTitle}</span></header>
        <div className="reader-page-viewport">
          <div className="reader-page-flow" style={{ columnWidth: flowPageWidth || undefined, columnGap: pageGap, transform: `translate3d(${-targetPage * (flowPageWidth + pageGap)}px, 0, 0)` }}>
            <h1>{chapterTitle}</h1>
            {paragraphs.map((paragraph) => <p key={paragraph.index}>{paragraph.text}</p>)}
          </div>
        </div>
        <footer><span>{author}</span><span>{pageLabel ?? `${targetPage + 1} / ${pageCount}`} · 总进度 {totalProgress}%</span></footer>
      </article>
    </div>;
  },
);

export default function ReaderFlipBook(props: ReaderFlipBookProps) {
    const engineRef = useRef<FlipEngine | null>(null);
    const pendingTurnRef = useRef<PendingTurn | null>(null);
    const windowStart = Math.max(0, Math.min(props.pageIndex - 1, props.pageCount - 3));
    const hasNextChapterPreview = props.pageIndex === props.pageCount - 1 && props.nextChapter !== null;
    const pageWindow = useMemo<FlipSlot[]>(() => {
      const pages: FlipSlot[] = Array.from(
        { length: Math.min(3, props.pageCount) },
        (_, index) => ({ type: "page", pageIndex: windowStart + index }),
      );
      if (hasNextChapterPreview && props.nextChapter) {
        pages.push({ type: "nextChapter", ...props.nextChapter });
      }
      return pages;
    }, [hasNextChapterPreview, props.nextChapter, props.pageCount, windowStart]);
    const startPage = Math.max(0, pageWindow.findIndex((page) => page.type === "page" && page.pageIndex === props.pageIndex));
    const flipPages = useMemo(
      () => pageWindow.map((page, index) => page.type === "nextChapter"
        ? <FlipPage key={index} {...props} chapterTitle={page.title} paragraphs={page.paragraphs} targetPage={0} pageLabel="1"/>
        : <FlipPage key={index} {...props} targetPage={page.pageIndex}/>),
      [pageWindow, props.author, props.chapterTitle, props.flowPageWidth, props.fontSize, props.lineHeight, props.pageCount, props.pageGap, props.paragraphs, props.title, props.totalProgress],
    );

    const turn = (direction: "next" | "previous") => {
      if (direction === "next") {
        if (props.pageIndex >= props.pageCount - 1 && !props.nextChapter) props.onBoundaryNext();
        else engineRef.current?.flipNext("bottom");
      } else if (props.pageIndex <= 0) {
        props.onBoundaryPrevious();
      } else {
        engineRef.current?.flipPrev("bottom");
      }
    };

    return <div className="reader-flip-book-shell">
      <HTMLFlipBook
        key={`${windowStart}:${hasNextChapterPreview}`}
        className="reader-flip-book"
        style={{}}
        width={Math.max(1, props.pageWidth)}
        height={Math.max(1, props.pageHeight)}
        size="fixed"
        minWidth={Math.max(1, props.pageWidth)}
        maxWidth={Math.max(1, props.pageWidth)}
        minHeight={Math.max(1, props.pageHeight)}
        maxHeight={Math.max(1, props.pageHeight)}
        startPage={startPage}
        drawShadow
        flippingTime={720}
        usePortrait
        singlePage={false}
        startZIndex={1}
        autoSize
        maxShadowOpacity={0.42}
        showCover={false}
        mobileScrollSupport
        clickEventForward
        useMouseEvents
        swipeDistance={24}
        showPageCorners={false}
        disableFlipByClick
        renderOnlyPageLengthChange={false}
        onInit={(event: { object?: FlipEngine }) => {
          engineRef.current = event.object ?? null;
        }}
        onFlip={(event: { data?: number }) => {
          const target = pageWindow[event.data ?? startPage];
          if (target?.type === "nextChapter") pendingTurnRef.current = { type: "nextChapter" };
          else if (target?.type === "page" && target.pageIndex !== props.pageIndex) pendingTurnRef.current = target;
        }}
        onChangeState={(event: { data?: string }) => {
          if (event.data !== "read" || pendingTurnRef.current === null) return;
          const target = pendingTurnRef.current;
          pendingTurnRef.current = null;
          if (target.type === "nextChapter") props.onBoundaryNext();
          else props.onPageChange(target.pageIndex);
        }}
      >
        {flipPages}
      </HTMLFlipBook>
      <button className="reader-turn-zone previous" aria-label="上一页" onClick={() => turn("previous")}>‹</button>
      <button className="reader-turn-zone next" aria-label="下一页" onClick={() => turn("next")}>›</button>
    </div>;
}
