import type { NovaDesktopStyle } from "../../app/novaSettings";

export default function DesktopStyleSwitch({ value, onChange }: {
  value: NovaDesktopStyle;
  onChange: (style: NovaDesktopStyle) => void;
}) {
  return <div className="desktop-style-switch" role="group" aria-label="桌面风格">
    <button type="button" aria-pressed={value === "classic"} onClick={() => onChange("classic")}><span aria-hidden="true">▦</span><strong>经典桌面</strong><small>自由排列图标 · 熟悉的任务栏</small></button>
    <button type="button" aria-pressed={value === "future"} onClick={() => onChange("future")}><span aria-hidden="true">◎</span><strong>未来空间</strong><small>分组应用 · 文件视图 · 窗口总览</small></button>
  </div>;
}
