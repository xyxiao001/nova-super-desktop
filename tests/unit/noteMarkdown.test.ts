import { describe, expect, it } from "vitest";
import { parseMarkdown, parseMarkdownInline, safeMarkdownHref } from "../../src/apps/notes/markdown";

describe("safe Markdown preview parser", () => {
  it("parses common blocks without evaluating raw HTML", () => {
    const blocks = parseMarkdown("# 标题\n\n- [x] 完成\n- [ ] 待办\n\n> 引用\n\n```ts\nconst x = 1;\n```\n\n<script>alert(1)</script>");
    expect(blocks.map((block) => block.type)).toEqual(["heading", "list", "quote", "code", "paragraph"]);
    expect(blocks.at(-1)).toEqual({ type: "paragraph", children: [{ type: "text", text: "<script>alert(1)</script>" }] });
  });

  it("supports inline emphasis, code, safe links and blocked images", () => {
    expect(parseMarkdownInline("**粗体** *斜体* `代码` [站点](https://example.com) ![照片](https://example.com/a.png)")).toEqual([
      { type: "strong", children: [{ type: "text", text: "粗体" }] }, { type: "text", text: " " },
      { type: "emphasis", children: [{ type: "text", text: "斜体" }] }, { type: "text", text: " " },
      { type: "code", text: "代码" }, { type: "text", text: " " },
      { type: "link", href: "https://example.com", children: [{ type: "text", text: "站点" }] }, { type: "text", text: " " },
      { type: "image", alt: "照片" },
    ]);
  });

  it("rejects executable and data URLs", () => {
    expect(safeMarkdownHref("javascript:alert(1)")).toBeNull();
    expect(safeMarkdownHref("data:text/html,bad")).toBeNull();
    expect(safeMarkdownHref("https://example.com")).toBe("https://example.com");
    expect(parseMarkdownInline("[危险](javascript:alert(1))").map((node) => node.type === "text" ? node.text : "").join(""))
      .toBe("[危险](javascript:alert(1))");
  });
});
