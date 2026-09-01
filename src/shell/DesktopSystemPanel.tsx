"use client";

import type { DesktopItem } from "../../app/desktopFiles";
import type { CalendarDay, DesktopNotification } from "../../app/desktopSystem";

type DesktopSystemPanelProps = {
  calendarTitle: string;
  calendarGrid: CalendarDay[];
  notifications: DesktopNotification[];
  visibleItems: DesktopItem[];
  onPreviousMonth: () => void;
  onCurrentMonth: () => void;
  onNextMonth: () => void;
  onClearNotifications: () => void;
  onLocateItem: (item: DesktopItem) => void;
};

export default function DesktopSystemPanel({
  calendarTitle,
  calendarGrid,
  notifications,
  visibleItems,
  onPreviousMonth,
  onCurrentMonth,
  onNextMonth,
  onClearNotifications,
  onLocateItem,
}: DesktopSystemPanelProps) {
  return (
    <aside className="system-panel" aria-label="日期与通知">
      <section className="calendar-panel">
        <header>
          <strong>{calendarTitle}</strong>
          <div>
            <button aria-label="上个月" onClick={onPreviousMonth}>
              ‹
            </button>
            <button aria-label="回到本月" onClick={onCurrentMonth}>
              ●
            </button>
            <button aria-label="下个月" onClick={onNextMonth}>
              ›
            </button>
          </div>
        </header>
        <div className="calendar-weekdays">
          {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {calendarGrid.map((day) => (
            <span
              key={day.key}
              className={`${day.currentMonth ? "" : "outside"} ${day.today ? "today" : ""}`}
            >
              {day.date}
            </span>
          ))}
        </div>
      </section>
      <section className="notification-panel">
        <header>
          <strong>文件活动</strong>
          {!!notifications.length && <button onClick={onClearNotifications}>全部清除</button>}
        </header>
        <div>
          {notifications.length ? (
            notifications.map((notification) => {
              const target = notification.itemId
                ? visibleItems.find((item) => item.id === notification.itemId)
                : null;
              return (
                <button
                  key={notification.id}
                  disabled={!target}
                  aria-label={target ? `定位${target.name}` : undefined}
                  onClick={() => target && onLocateItem(target)}
                >
                  <i>▰</i>
                  <span>
                    <strong>{notification.message}</strong>
                    <small>
                      {new Intl.DateTimeFormat("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      }).format(notification.createdAt)}
                      {target ? " · 打开所在位置" : ""}
                    </small>
                  </span>
                </button>
              );
            })
          ) : (
            <p>暂无文件操作记录</p>
          )}
        </div>
      </section>
    </aside>
  );
}
