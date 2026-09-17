import { describe, expect, it } from "vitest";
import { createAppLaunchIntent, launchIntentFor } from "../../app/appLaunch";
import { allTextMatches, firstTextMatch, nextTextMatchIndex, textSearchResult } from "../../app/textSearch";

describe("text search", () => {
  it("finds the first exact case-insensitive range", () => {
    expect(firstTextMatch("Alpha alpha", "ALPHA")).toEqual({ start: 0, end: 5 });
    expect(firstTextMatch("Alpha", "   ")).toBeNull();
    expect(firstTextMatch("Alpha", "beta")).toBeNull();
  });

  it("builds a compact normalized excerpt around the first match", () => {
    expect(textSearchResult("开头\n目标文字\n结尾", "目标", 2)).toEqual({
      start: 3,
      end: 5,
      excerpt: "…头 目标文字…",
    });
  });

  it("marks truncated edges without adding ellipses at content boundaries", () => {
    expect(textSearchResult("目标在开头，后面很长", "目标", 2)?.excerpt).toBe("目标在开…");
    expect(textSearchResult("前面很长，目标", "目标", 2)?.excerpt).toBe("…长，目标");
  });

  it("enumerates non-overlapping matches and wraps navigation", () => {
    expect(allTextMatches("Alpha alpha ALPHA", "alpha")).toEqual([
      { start: 0, end: 5 }, { start: 6, end: 11 }, { start: 12, end: 17 },
    ]);
    expect(allTextMatches("aaaa", "aa")).toEqual([{ start: 0, end: 2 }, { start: 2, end: 4 }]);
    expect(allTextMatches("text", "   ")).toEqual([]);
    expect(nextTextMatchIndex(-1, 3, 1)).toBe(0);
    expect(nextTextMatchIndex(-1, 3, -1)).toBe(2);
    expect(nextTextMatchIndex(2, 3, 1)).toBe(0);
    expect(nextTextMatchIndex(0, 3, -1)).toBe(2);
    expect(nextTextMatchIndex(0, 0, 1)).toBe(-1);
  });

  it("keeps a notes selection in its launch intent", () => {
    const intent = createAppLaunchIntent(4, { app: "notes", kind: "text", itemId: "note", selection: { start: 3, end: 5, query: "目标" } });
    expect(launchIntentFor(intent, "notes")).toEqual(intent);
    expect(launchIntentFor(intent, "reader")).toBeNull();
  });
});
