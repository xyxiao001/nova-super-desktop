import type { WindowAppId } from "../apps/appRegistry";
import type { WindowSnapMode } from "./windowGeometry";

export type WindowInstanceId = `${WindowAppId}:${string}`;

export type WindowInstanceTarget =
  | { kind: "folder"; itemId: string }
  | { kind: "text"; itemId: string }
  | { kind: "image"; itemId: string };

export type WindowInstance = {
  id: WindowInstanceId;
  app: WindowAppId;
  target?: WindowInstanceTarget;
  minimized: boolean;
  maximized: boolean;
  snapMode?: WindowSnapMode;
  z: number;
  title?: string;
  taskbarTitle?: string;
};

export type WindowInstanceMap = Partial<Record<WindowInstanceId, WindowInstance>>;

export type WindowInstanceManagerState = {
  instances: WindowInstanceMap;
  focused: "desktop" | WindowInstanceId;
  nextZ: number;
};

export type WindowInstancePatch = Partial<
  Pick<
    WindowInstance,
    "minimized" | "maximized" | "snapMode" | "title" | "taskbarTitle"
  >
>;

export type WindowInstanceAction =
  | {
      type: "open";
      id: WindowInstanceId;
      app: WindowAppId;
      target?: WindowInstanceTarget;
    }
  | { type: "focus"; id: WindowInstanceId }
  | { type: "focus-desktop" }
  | { type: "close"; id: WindowInstanceId }
  | { type: "dismiss"; id: WindowInstanceId }
  | { type: "minimize"; id: WindowInstanceId }
  | { type: "toggle-maximize"; id: WindowInstanceId }
  | { type: "snap"; id: WindowInstanceId; mode: WindowSnapMode }
  | { type: "retarget"; id: WindowInstanceId; target?: WindowInstanceTarget }
  | { type: "update"; id: WindowInstanceId; patch: WindowInstancePatch };

export function createInitialWindowInstanceManagerState(): WindowInstanceManagerState {
  return {
    instances: {},
    focused: "desktop",
    nextZ: 1,
  };
}

export function singletonWindowInstanceId(app: WindowAppId): WindowInstanceId {
  return `${app}:main`;
}

export function createWindowInstanceId(
  app: WindowAppId,
  token: string,
): WindowInstanceId {
  return `${app}:${token}`;
}

export function allWindowInstances(instances: WindowInstanceMap): WindowInstance[] {
  return Object.values(instances).filter(
    (instance): instance is WindowInstance => !!instance,
  );
}

export function instancesForApp(
  state: WindowInstanceManagerState,
  app: WindowAppId,
): WindowInstance[] {
  return allWindowInstances(state.instances)
    .filter((instance) => instance.app === app)
    .sort((left, right) => right.z - left.z);
}

export function mostRecentInstanceForApp(
  state: WindowInstanceManagerState,
  app: WindowAppId,
): WindowInstance | undefined {
  return instancesForApp(state, app)[0];
}

export function mostRecentUnboundInstanceForApp(
  state: WindowInstanceManagerState,
  app: WindowAppId,
): WindowInstance | undefined {
  return instancesForApp(state, app).find((instance) => !instance.target);
}

export function findResourceWindowInstance(
  state: WindowInstanceManagerState,
  app: WindowAppId,
  target: WindowInstanceTarget,
): WindowInstance | undefined {
  return instancesForApp(state, app).find((instance) => (
    instance.target?.kind === target.kind
    && instance.target.itemId === target.itemId
  ));
}

export function selectResourceWindowInstance(
  state: WindowInstanceManagerState,
  app: WindowAppId,
  target: WindowInstanceTarget,
  reuseMostRecent: boolean,
): WindowInstance | undefined {
  return findResourceWindowInstance(state, app, target)
    ?? (reuseMostRecent
      ? mostRecentInstanceForApp(state, app)
      : mostRecentUnboundInstanceForApp(state, app));
}

export function topWindowInstance(
  instances: WindowInstanceMap,
  exclude?: WindowInstanceId,
): "desktop" | WindowInstanceId {
  return allWindowInstances(instances)
    .filter((instance) => instance.id !== exclude && !instance.minimized)
    .sort((left, right) => right.z - left.z)[0]?.id
    ?? "desktop";
}

export function windowInstanceIsActive(
  state: WindowInstanceManagerState,
  id: WindowInstanceId,
): boolean {
  const instance = state.instances[id];
  return state.focused === id && !!instance && !instance.minimized;
}

const patchWindowInstance = (
  state: WindowInstanceManagerState,
  id: WindowInstanceId,
  patch: WindowInstancePatch,
): WindowInstanceManagerState => ({
  ...state,
  instances: {
    ...state.instances,
    [id]: { ...state.instances[id], ...patch },
  },
});

export function windowInstanceReducer(
  state: WindowInstanceManagerState,
  action: WindowInstanceAction,
): WindowInstanceManagerState {
  if (action.type === "focus-desktop") return { ...state, focused: "desktop" };

  if (action.type === "open") {
    const z = state.nextZ + 1;
    const current = state.instances[action.id];
    const instance: WindowInstance = current
      ? {
          ...current,
          target: action.target ?? current.target,
          minimized: false,
          z,
        }
      : {
          id: action.id,
          app: action.app,
          target: action.target,
          minimized: false,
          maximized: false,
          z,
        };
    return {
      ...state,
      instances: { ...state.instances, [action.id]: instance },
      focused: action.id,
      nextZ: z,
    };
  }

  if (!state.instances[action.id]) return state;

  if (action.type === "close") {
    const instances = { ...state.instances };
    delete instances[action.id];
    return {
      ...state,
      instances,
      focused: state.focused === action.id
        ? topWindowInstance(instances)
        : state.focused,
    };
  }

  if (action.type === "dismiss") {
    const instances = { ...state.instances };
    delete instances[action.id];
    return {
      ...state,
      instances,
      focused: state.focused === action.id
        ? topWindowInstance(instances)
        : state.focused,
    };
  }

  if (action.type === "focus") {
    const z = state.nextZ + 1;
    return {
      ...state,
      instances: {
        ...state.instances,
        [action.id]: {
          ...state.instances[action.id],
          minimized: false,
          z,
        },
      },
      focused: action.id,
      nextZ: z,
    };
  }

  if (action.type === "minimize") {
    const next = patchWindowInstance(state, action.id, { minimized: true });
    return {
      ...next,
      focused: state.focused === action.id
        ? topWindowInstance(next.instances, action.id)
        : state.focused,
    };
  }

  if (action.type === "toggle-maximize") {
    const instance = state.instances[action.id]!;
    return patchWindowInstance(state, action.id, {
      maximized: !instance.maximized,
      snapMode: undefined,
    });
  }

  if (action.type === "snap") {
    return {
      ...patchWindowInstance(state, action.id, {
        maximized: false,
        minimized: false,
        snapMode: action.mode,
      }),
      focused: action.id,
    };
  }

  if (action.type === "retarget") {
    return {
      ...state,
      instances: {
        ...state.instances,
        [action.id]: {
          ...state.instances[action.id],
          target: action.target,
        },
      },
    };
  }

  return patchWindowInstance(state, action.id, action.patch);
}
