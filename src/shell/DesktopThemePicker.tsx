import type { NovaDesktopLook } from "../../app/novaSettings";

export const DESKTOP_THEMES: { id: NovaDesktopLook; label: string; detail: string }[] = [
  { id: "original", label: "原生光影", detail: "保留桌面原有材质与壁纸" },
  { id: "retro", label: "复古终端", detail: "琥珀荧光 · 扫描纹理 · 硬边窗口" },
  { id: "cartoon", label: "糖果星球", detail: "奶油天空 · 云朵 · 弹性卡片" },
  { id: "paper", label: "纸间手账", detail: "方格纸 · 墨线 · 便签材质" },
];

export default function DesktopThemePicker({ value, onChange }: {
  value: NovaDesktopLook;
  onChange: (look: NovaDesktopLook) => void;
}) {
  return <div className="desktop-theme-options" role="group" aria-label="场景主题">
    {DESKTOP_THEMES.map((theme) => <button key={theme.id} type="button" aria-pressed={value === theme.id} onClick={() => onChange(theme.id)}>
      <span className={`desktop-theme-preview preview-${theme.id}`} aria-hidden="true"><i/><i/><i/></span>
      <span className="desktop-theme-caption"><strong>{theme.label}<b aria-hidden="true">{value === theme.id ? "✓" : ""}</b></strong><small>{theme.detail}</small></span>
    </button>)}
  </div>;
}
