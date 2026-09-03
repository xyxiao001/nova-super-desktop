import type { WindowAppId } from "../src/platform/apps/appManifest";

export const NOVA_ACTIVITY_EVENT = "nova-activity";

export type NovaActivityEventType =
  | "app-activated"
  | "file-created"
  | "files-organized"
  | "creative-saved"
  | "reading-started"
  | "reading-milestone"
  | "excerpt-created"
  | "note-created"
  | "focus-started"
  | "focus-ended"
  | "focus-completed"
  | "pet-interacted"
  | "game-finished"
  | "wallpaper-changed";

export type NovaActivityEventPayload = {
  outcome?: "win" | "loss" | "draw";
  itemType?: "folder" | "text" | "image";
  operation?: "move" | "copy" | "trash" | "delete" | "restore" | "arrange";
  count?: number;
  progressBucket?: 25 | 50 | 75 | 100;
  durationBucket?: "short" | "medium" | "long";
  interaction?: "pet" | "high-five" | "play";
  localResourceId?: string;
};

export type NovaActivityEvent = {
  id: string;
  type: NovaActivityEventType;
  source: WindowAppId | "desktop";
  occurredAt: number;
  payload?: NovaActivityEventPayload;
};

const READING_MILESTONES = [25, 50, 75, 100] as const;

type ActivityEventTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener" | "dispatchEvent"
>;

export const readingMilestoneForProgress = (
  previousProgress: number,
  currentProgress: number,
) => READING_MILESTONES.filter(
  (milestone) => previousProgress < milestone && currentProgress >= milestone,
).at(-1);

export const createNovaActivityEvent = (
  type: NovaActivityEventType,
  source: NovaActivityEvent["source"],
  payload?: NovaActivityEventPayload,
  id = crypto.randomUUID(),
  occurredAt = Date.now(),
): NovaActivityEvent => ({
  id,
  type,
  source,
  occurredAt,
  ...(payload ? { payload } : {}),
});

export const publishNovaActivityEvent = (
  type: NovaActivityEventType,
  source: NovaActivityEvent["source"],
  payload?: NovaActivityEventPayload,
  target: ActivityEventTarget = window,
) => {
  const activity = createNovaActivityEvent(type, source, payload);
  target.dispatchEvent(new CustomEvent<NovaActivityEvent>(
    NOVA_ACTIVITY_EVENT,
    { detail: activity },
  ));
  return activity;
};

export const subscribeNovaActivityEvents = (
  listener: (activity: NovaActivityEvent) => void,
  target: ActivityEventTarget = window,
) => {
  const handler = (event: Event) => {
    listener((event as CustomEvent<NovaActivityEvent>).detail);
  };
  target.addEventListener(NOVA_ACTIVITY_EVENT, handler);
  return () => target.removeEventListener(NOVA_ACTIVITY_EVENT, handler);
};
