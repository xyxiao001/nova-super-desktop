import {
  APP_MANIFESTS,
  type AppDefinition,
  type StartAppGroup,
  type WindowAppId,
} from "./appManifest";

export type { AppDefinition, StartAppGroup, WindowAppId } from "./appManifest";

export const START_APP_GROUPS: { id: StartAppGroup; label: string }[] = [
  { id: "create", label: "创作与阅读" },
  { id: "productivity", label: "效率工具" },
  { id: "system", label: "系统与娱乐" },
];

export const APP_REGISTRY = Object.fromEntries(
  Object.entries(APP_MANIFESTS).map(([id, manifest]) => {
    const { load: _load, ...definition } = manifest;
    return [id, { id, ...definition }];
  }),
) as Record<WindowAppId, AppDefinition>;

export const REGISTERED_APPS = Object.values(APP_REGISTRY);
export const LAUNCHER_APPS = REGISTERED_APPS.filter((app) => app.launcher);
export const START_PINNED_APPS = LAUNCHER_APPS.filter((app) => app.startPinned);
