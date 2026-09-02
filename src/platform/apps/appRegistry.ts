import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  APP_MANIFESTS,
  type AppManifestEntry,
  type AppDefinition,
  type StartAppGroup,
  type WindowAppId,
} from "./appManifest";

export type {
  AppDefinition,
  StartAppGroup,
  WindowInstancePolicy,
  WindowAppId,
} from "./appManifest";

export const START_APP_GROUPS: { id: StartAppGroup; label: string }[] = [
  { id: "create", label: "创作与阅读" },
  { id: "productivity", label: "效率工具" },
  { id: "system", label: "系统与娱乐" },
];

export const APP_REGISTRY = Object.fromEntries(
  Object.entries(APP_MANIFESTS).map(([id, manifest]) => {
    const entry = manifest as AppManifestEntry;
    const definition: AppDefinition = {
      id: id as WindowAppId,
      label: entry.label,
      icon: entry.icon,
      kind: entry.kind,
      launcher: entry.launcher,
      taskbarPinned: entry.taskbarPinned,
      startPinned: entry.startPinned,
      startGroup: entry.startGroup,
      windowIcon: entry.windowIcon,
      taskbarIcon: entry.taskbarIcon,
      window: {
        ...entry.window,
        instancePolicy: entry.window.instancePolicy ?? "singleton",
      },
    };
    return [id, definition];
  }),
) as Record<WindowAppId, AppDefinition>;

export const REGISTERED_APPS = Object.values(APP_REGISTRY);
export const LAUNCHER_APPS = REGISTERED_APPS.filter((app) => app.launcher);
export const START_PINNED_APPS = LAUNCHER_APPS.filter((app) => app.startPinned);

export const appModuleLoaders = Object.fromEntries(
  Object.entries(APP_MANIFESTS).map(([id, manifest]) => [id, manifest.load]),
) as { [K in WindowAppId]: (typeof APP_MANIFESTS)[K]["load"] };

export const APP_COMPONENTS = Object.fromEntries(
  Object.keys(APP_MANIFESTS).map((app) => [
    app,
    lazy(
      APP_MANIFESTS[app as WindowAppId].load as () => Promise<{
        default: ComponentType;
      }>,
    ),
  ]),
) as Record<WindowAppId, LazyExoticComponent<ComponentType>>;
