import { useEffect, useRef, useState } from "react";
import { READING_BREAK_MS, READING_STATS_KEY, readReadingStats, readingDuration, recordReadingTime, startReadingClock, summarizeReading, type ReadingStats } from "./readingStats";

const whispers = [
  "翻过的每一页，都在悄悄滋养你的小书苗。",
  "喜欢的句子可以摘录下来，留给以后的自己。",
  "故事不会跑掉，喝口水再回来也刚刚好。",
  "偶尔看看窗外，让眼睛也读一读远处的风景。",
];

export default function ReaderCompanion({ bookId, active = false }: { bookId?: string; active?: boolean }) {
  const [stats, setStats] = useState<ReadingStats>({ days: {} });
  const [session, setSession] = useState(0);
  const [reminder, setReminder] = useState(false);
  const [resting, setResting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [whisper, setWhisper] = useState(0);
  const elapsed = useRef(0);
  const nextBreak = useRef(READING_BREAK_MS);

  useEffect(() => { setStats(readReadingStats()); }, []);
  useEffect(() => {
    if (!bookId || !active || resting) return;
    return startReadingClock((from, to) => {
      const next = recordReadingTime(readReadingStats(), bookId, from, to);
      localStorage.setItem(READING_STATS_KEY, JSON.stringify(next));
      setStats(next);
      elapsed.current += to - from;
      setSession(elapsed.current);
      if (elapsed.current >= nextBreak.current) {
        setExpanded(false);
        setReminder(true);
      }
    });
  }, [bookId, active, resting]);

  const summary = summarizeReading(stats, Date.now(), bookId);
  const plant = summary.total >= 5 * 3_600_000 ? ["🌳", "书香小树"] : summary.total >= 3_600_000 ? ["🌿", "新叶初长"] : ["🌱", "阅读小苗"];
  const postpone = () => {
    nextBreak.current = elapsed.current + READING_BREAK_MS;
    setReminder(false);
  };
  const resume = () => { postpone(); setResting(false); };
  const rest = () => { setExpanded(false); setReminder(false); setResting(true); };
  const content = <>
    <header><span aria-hidden="true">{plant[0]}</span><div><strong>{plant[1]}</strong><small>从开启统计起，记录每一段阅读时光</small></div></header>
    <dl>
      <div><dt>今日阅读</dt><dd>{readingDuration(summary.today)}</dd></div>
      <div><dt>累计阅读</dt><dd>{readingDuration(summary.total)}</dd></div>
      <div><dt>阅读天数</dt><dd>{summary.days} 天</dd></div>
      {bookId && <div><dt>本书累计</dt><dd>{readingDuration(summary.book)}</dd></div>}
    </dl>
    <p aria-live="polite">{whispers[whisper]}</p>
    <footer><button onClick={() => setWhisper((value) => (value + 1) % whispers.length)}>换句悄悄话 ↻</button>{bookId && <button onClick={() => resting ? resume() : rest()}>{resting ? "继续阅读" : "歇一会儿"}</button>}</footer>
  </>;

  if (!bookId) return <section className="reader-statistics-card" aria-label="阅读统计">{content}</section>;
  return <div className="reader-companion">
    <details className="reader-statistics-popover" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary aria-label="阅读统计"><span aria-hidden="true">{plant[0]}</span>{resting ? "休息中" : `本次 ${readingDuration(session)}`}</summary>
      <section className="reader-statistics-card" aria-label="阅读统计详情">{content}</section>
    </details>
    {active && (reminder || resting) && <aside className="reader-rest-notice" role="status">
      <strong>{resting ? "给眼睛放个小假 ☁" : `这次已读 ${readingDuration(session)}，休息一下吧`}</strong>
      <p>{resting ? "计时已暂停。伸个懒腰、喝口水，故事会等你。" : "抬头看看远处，放松一下肩颈，小书苗也要晒晒太阳。"}</p>
      <div>{resting ? <button onClick={resume}>休息好了，继续读</button> : <><button onClick={rest}>歇一会儿</button><button onClick={postpone}>再读一会儿</button></>}</div>
    </aside>}
  </div>;
}
