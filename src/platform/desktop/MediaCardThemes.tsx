import "./mediaCardThemes.css";

export const MEDIA_CARD_THEMES = [
  { id: "warm", label: "复古暖调" },
  { id: "night", label: "午夜深色" },
  { id: "glass", label: "透光玻璃" },
] as const;
export type MediaCardTheme = typeof MEDIA_CARD_THEMES[number]["id"];

export default function MediaCardThemes({ value, onChange, label }: {
  value: MediaCardTheme; onChange: (theme: MediaCardTheme) => void; label: string;
}) {
  return <div className="media-card-themes" role="group" aria-label={label}>
    {MEDIA_CARD_THEMES.map(theme => <button key={theme.id} className={`media-theme-${theme.id}`} aria-label={theme.label} title={theme.label} aria-pressed={value === theme.id} onClick={() => onChange(theme.id)}><span aria-hidden="true" /></button>)}
  </div>;
}
