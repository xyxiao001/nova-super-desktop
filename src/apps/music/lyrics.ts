export type LyricWord = { text: string; start: number; end: number };
export type LyricLine = {
  text: string;
  start: number;
  end: number;
  words: LyricWord[];
};
export type Lyrics = {
  lines: LyricLine[];
  offset: number;
  title: string;
  artist: string;
  timed: boolean;
};
const stamp = (value: string) =>
  value
    .replace(",", ".")
    .replace(/^(\d+:\d+):(\d+)$/, "$1.$2")
    .split(":")
    .reduce((sum, n) => sum * 60 + Number(n), 0);
const clock = /\[(\d{1,3}:\d{2}(?:[.:]\d{1,3})?)\]/g;
export function parseLyrics(source: string, songEnd = Infinity): Lyrics {
  const result: Lyrics = {
    lines: [],
    offset: Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000,
    title: source.match(/\[ti:(.*?)\]/i)?.[1] ?? "",
    artist: source.match(/\[ar:(.*?)\]/i)?.[1] ?? "",
    timed: false,
  };
  const input = source.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const add = (
    start: number,
    text: string,
    words: LyricWord[] = [],
    end = Infinity,
  ) => result.lines.push({ start, end, text, words });
  if (/\d{2}:\d{2}[.,]\d{3}\s*-->/.test(input)) {
    for (const block of input.split(/\n\s*\n/)) {
      const match = block.match(
        /((?:\d+:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d{3})[^\n]*\n([\s\S]*)/,
      );
      if (match)
        add(
          stamp(match[1]),
          match[3].replace(/<[^>]+>/g, ""),
          [],
          stamp(match[2]),
        );
    }
  } else {
    for (const sourceLine of input.split("\n")) {
      const raw = sourceLine.trimStart();
      if (!raw.trim() || /^\[(?:ti|ar|al|by|offset|re|ve):/i.test(raw))
        continue;
      const yrc = raw.match(/^\[(\d+),(\d+)\](.*)$/);
      if (yrc) {
        const words: LyricWord[] = [];
        // Both YRC and plaintext QRC store absolute word starts in milliseconds.
        for (const m of yrc[3].matchAll(/\((\d+),(\d+),\d+\)([^()]*)/g))
          words.push({
            start: +m[1] / 1000,
            end: (+m[1] + +m[2]) / 1000,
            text: m[3],
          });
        if (!words.length)
          for (const m of yrc[3].matchAll(/([^()]+)\((\d+),(\d+)\)/g))
            words.push({
              start: +m[2] / 1000,
              end: (+m[2] + +m[3]) / 1000,
              text: m[1],
            });
        add(
          +yrc[1] / 1000,
          words.map((w) => w.text).join(""),
          words,
          (+yrc[1] + +yrc[2]) / 1000,
        );
        continue;
      }
      const marks = [...raw.matchAll(clock)];
      if (!marks.length) {
        if (!/^\[.*\]$/.test(raw)) add(Infinity, raw);
        continue;
      }
      const firstEnd = marks[0].index! + marks[0][0].length;
      const interleaved =
        marks.length > 1 && raw.slice(firstEnd, marks[1].index).length > 0;
      if (interleaved) {
        const words = marks.flatMap((m, i) => {
          const text = raw.slice(m.index! + m[0].length, marks[i + 1]?.index);
          return text
            ? [
                {
                  text,
                  start: stamp(m[1]),
                  end: marks[i + 1] ? stamp(marks[i + 1][1]) : Infinity,
                },
              ]
            : [];
        });
        add(
          stamp(marks[0][1]),
          words.map((w) => w.text).join(""),
          words,
          stamp(marks[marks.length - 1][1]) > (words.at(-1)?.start ?? Infinity)
            ? stamp(marks[marks.length - 1][1])
            : Infinity,
        );
      } else {
        const prefix = raw.match(/^(?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+/)![0];
        const body = raw.slice(prefix.length);
        const enhanced = [...body.matchAll(/<(\d{1,3}:\d{2}(?:\.\d{1,3})?)>/g)];
        const words = enhanced.flatMap((m, i) => {
          const text = body.slice(
            m.index! + m[0].length,
            enhanced[i + 1]?.index,
          );
          return text
            ? [
                {
                  text,
                  start: stamp(m[1]),
                  end: enhanced[i + 1] ? stamp(enhanced[i + 1][1]) : Infinity,
                },
              ]
            : [];
        });
        for (const m of prefix.matchAll(clock))
          add(
            stamp(m[1]),
            body.replace(/<\d[^>]*>/g, ""),
            words.map((w) => ({ ...w })),
          );
      }
    }
  }
  result.lines.sort((a, b) => a.start - b.start);
  result.lines.forEach((line, i) => {
    if (line.end === Infinity && Number.isFinite(line.start))
      line.end = result.lines[i + 1]?.start ?? songEnd;
    line.words.forEach((w) => {
      if (w.end === Infinity) w.end = line.end;
    });
  });
  result.timed = result.lines.some((l) => Number.isFinite(l.start));
  return result;
}
export function activeLine(lines: LyricLine[], time: number) {
  let found = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].start > time) break;
    if (time < lines[i].end) found = i;
  }
  return found;
}
export function wordProgress(word: LyricWord, time: number) {
  return time <= word.start
    ? 0
    : time >= word.end
      ? 100
      : Number.isFinite(word.end)
        ? ((time - word.start) / (word.end - word.start)) * 100
        : 0;
}
export const lyricExtensions = /\.(lrc|txt|srt|vtt|yrc|qrc)$/i;
