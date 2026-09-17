import {
  DESKTOP_OBJECT_THEMES,
  type DesktopObject,
  type DesktopObjectTheme,
} from "../../app/desktopObjects";

type DesktopObjectThemePickerProps = {
  object: DesktopObject;
  onChange: (theme: DesktopObjectTheme) => void;
};

export default function DesktopObjectThemePicker({ object, onChange }: DesktopObjectThemePickerProps) {
  return (
    <fieldset className="desktop-object-theme-picker">
      <legend>{object.kind === "note-card" ? "便笺主题" : "照片主题"}</legend>
      <div className="desktop-object-theme-options">
        {DESKTOP_OBJECT_THEMES[object.kind].map((theme) => (
          <button
            key={theme.label}
            type="button"
            aria-pressed={object.theme === theme.value}
            onClick={() => onChange(theme.value)}
          >
            <i
              className={`object-theme-swatch ${object.kind}-swatch`}
              data-object-theme={theme.value}
              aria-hidden="true"
            />
            {theme.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
