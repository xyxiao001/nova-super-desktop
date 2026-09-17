import { Fragment, createElement, type ReactNode } from "react";
import { parseMarkdown, type MarkdownInline } from "./markdown";

function renderInline(nodes: MarkdownInline[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}:${index}`;
    if (node.type === "text") return <Fragment key={key}>{node.text}</Fragment>;
    if (node.type === "code") return <code key={key}>{node.text}</code>;
    if (node.type === "image") return <span className="note-markdown-image" key={key}>[图片已阻止加载：{node.alt || "未命名"}]</span>;
    const children = renderInline(node.children, key);
    if (node.type === "strong") return <strong key={key}>{children}</strong>;
    if (node.type === "emphasis") return <em key={key}>{children}</em>;
    if (node.type === "strike") return <del key={key}>{children}</del>;
    const external = /^(?:https?:|mailto:)/i.test(node.href);
    return <a key={key} href={node.href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{children}</a>;
  });
}

export default function MarkdownPreview({ value }: { value: string }) {
  const blocks = parseMarkdown(value);
  if (!blocks.length) return <div className="note-markdown-empty">没有可预览的内容</div>;
  return <article className="note-markdown-preview" aria-label="Markdown 预览">{blocks.map((block, index) => {
    const key = `block:${index}`;
    if (block.type === "heading") return createElement(`h${block.level}`, { key }, renderInline(block.children, key));
    if (block.type === "paragraph") return <p key={key}>{renderInline(block.children, key)}</p>;
    if (block.type === "quote") return <blockquote key={key}>{renderInline(block.children, key)}</blockquote>;
    if (block.type === "rule") return <hr key={key}/>;
    if (block.type === "code") return <pre key={key} data-language={block.language || undefined}><code>{block.text}</code></pre>;
    const List = block.ordered ? "ol" : "ul";
    return <List key={key}>{block.items.map((item, itemIndex) => <li key={`${key}:${itemIndex}`} className={item.checked === undefined ? undefined : "task-list-item"}>{item.checked !== undefined && <input type="checkbox" checked={item.checked} readOnly aria-label={item.checked ? "已完成" : "未完成"}/>}<span>{renderInline(item.children, `${key}:${itemIndex}`)}</span></li>)}</List>;
  })}</article>;
}
