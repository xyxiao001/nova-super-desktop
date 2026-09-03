export const NOVA_SYSTEM_MOMENT_EVENT = "nova-system-moment";

export type NovaSystemMomentType =
  | "creative-save"
  | "focus-complete"
  | "game-win";

export type NovaSystemMomentSource =
  | "photo"
  | "drawing"
  | "focus"
  | "mines"
  | "chess"
  | "gomoku";

export type NovaSystemMoment = {
  id: string;
  type: NovaSystemMomentType;
  source: NovaSystemMomentSource;
};

type SystemMomentEventTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener" | "dispatchEvent"
>;

export const createNovaSystemMoment = (
  type: NovaSystemMomentType,
  source: NovaSystemMomentSource,
  id = crypto.randomUUID(),
): NovaSystemMoment => ({ id, type, source });

export const publishNovaSystemMoment = (
  type: NovaSystemMomentType,
  source: NovaSystemMomentSource,
  target: SystemMomentEventTarget = window,
  id?: string,
) => {
  const moment = createNovaSystemMoment(type, source, id);
  target.dispatchEvent(new CustomEvent<NovaSystemMoment>(
    NOVA_SYSTEM_MOMENT_EVENT,
    { detail: moment },
  ));
  return moment;
};

export const subscribeNovaSystemMoments = (
  listener: (moment: NovaSystemMoment) => void,
  target: SystemMomentEventTarget = window,
) => {
  const handler = (event: Event) => {
    listener((event as CustomEvent<NovaSystemMoment>).detail);
  };
  target.addEventListener(NOVA_SYSTEM_MOMENT_EVENT, handler);
  return () => target.removeEventListener(NOVA_SYSTEM_MOMENT_EVENT, handler);
};

export const replaceSystemMoment = (
  _current: NovaSystemMoment | null,
  next: NovaSystemMoment,
) => next;

export const clearSystemMoment = (
  current: NovaSystemMoment | null,
  id: string,
) => current?.id === id ? null : current;

export const systemMomentDuration = (
  type: NovaSystemMomentType,
  reducedMotion: boolean,
) => reducedMotion ? 600 : type === "creative-save" ? 1800 : 2400;
