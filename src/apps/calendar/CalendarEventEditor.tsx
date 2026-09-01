"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import {
  normalizeCalendarEventDraft,
  validateCalendarEventDraft,
  type CalendarEvent,
  type CalendarEventColor,
  type CalendarEventDraft,
} from "./calendarEventCore";

const COLORS: Array<{ id: CalendarEventColor; label: string }> = [
  { id: "teal", label: "青绿" },
  { id: "red", label: "朱红" },
  { id: "blue", label: "靛蓝" },
  { id: "amber", label: "琥珀" },
];

const emptyDraft = (date: string): CalendarEventDraft => ({
  title: "",
  date,
  allDay: true,
  startTime: "09:00",
  endTime: "10:00",
  color: "teal",
  notes: "",
});

type CalendarEventEditorProps = {
  date: string;
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (draft: CalendarEventDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function CalendarEventEditor({
  date,
  event,
  onClose,
  onSave,
  onDelete,
}: CalendarEventEditorProps) {
  const [draft, setDraft] = useState<CalendarEventDraft>(() => event ?? emptyDraft(date));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const update = <Key extends keyof CalendarEventDraft>(key: Key, value: CalendarEventDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const save = async () => {
    const normalized = normalizeCalendarEventDraft(draft);
    const validationError = validateCalendarEventDraft(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      await onSave(normalized);
    } catch {
      setError("日程保存失败，请重试");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!event) return;
    setSaving(true);
    try {
      await onDelete(event.id);
    } catch {
      setError("日程删除失败，请重试");
      setSaving(false);
      setDeleteConfirming(false);
    }
  };

  const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLElement>) => {
    if (keyboardEvent.key !== "Escape" || saving) return;
    keyboardEvent.stopPropagation();
    onClose();
  };

  return <div className="calendar-event-layer">
    <section
      className="calendar-event-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-title"
      onKeyDown={handleKeyDown}
    >
      <header>
        <div>
          <span>{event ? "编辑日程" : "新建日程"}</span>
          <strong id="calendar-event-title">{draft.date}</strong>
        </div>
        <button type="button" aria-label="关闭日程编辑器" onClick={onClose} disabled={saving}>×</button>
      </header>

      <div className="calendar-event-form">
        <label className="calendar-event-title-field">
          <span>日程名称</span>
          <input
            ref={titleInputRef}
            maxLength={80}
            value={draft.title}
            placeholder="输入日程名称"
            onChange={(inputEvent) => update("title", inputEvent.target.value)}
          />
        </label>

        <div className="calendar-event-form-row">
          <label>
            <span>日期</span>
            <input type="date" value={draft.date} onChange={(inputEvent) => update("date", inputEvent.target.value)}/>
          </label>
          <label className="calendar-event-all-day">
            <input
              type="checkbox"
              checked={draft.allDay}
              onChange={(inputEvent) => update("allDay", inputEvent.target.checked)}
            />
            <span>全天</span>
          </label>
        </div>

        {!draft.allDay && <div className="calendar-event-time-row">
          <label><span>开始</span><input type="time" value={draft.startTime} onChange={(inputEvent) => update("startTime", inputEvent.target.value)}/></label>
          <i aria-hidden="true">至</i>
          <label><span>结束</span><input type="time" value={draft.endTime} onChange={(inputEvent) => update("endTime", inputEvent.target.value)}/></label>
        </div>}

        <fieldset className="calendar-event-colors">
          <legend>颜色</legend>
          <div role="radiogroup" aria-label="日程颜色">
            {COLORS.map((color) => <button
              key={color.id}
              type="button"
              role="radio"
              aria-checked={draft.color === color.id}
              aria-label={color.label}
              className={`${color.id} ${draft.color === color.id ? "selected" : ""}`}
              onClick={() => update("color", color.id)}
            />)}
          </div>
        </fieldset>

        <label className="calendar-event-notes">
          <span>备注</span>
          <textarea
            maxLength={500}
            value={draft.notes}
            placeholder="添加备注"
            onChange={(inputEvent) => update("notes", inputEvent.target.value)}
          />
        </label>

        {error && <p className="calendar-event-error" role="alert">{error}</p>}
      </div>

      <footer>
        {event && (deleteConfirming
          ? <div className="calendar-event-delete-confirm">
            <span>确认删除？</span>
            <button type="button" onClick={() => setDeleteConfirming(false)} disabled={saving}>取消</button>
            <button type="button" className="danger" onClick={() => void remove()} disabled={saving}>删除</button>
          </div>
          : <button type="button" className="calendar-event-delete" onClick={() => setDeleteConfirming(true)} disabled={saving}>删除日程</button>)}
        <div className="calendar-event-submit">
          <button type="button" onClick={onClose} disabled={saving}>取消</button>
          <button type="button" className="primary" onClick={() => void save()} disabled={saving}>
            {saving ? "正在保存" : "保存"}
          </button>
        </div>
      </footer>
    </section>
  </div>;
}
