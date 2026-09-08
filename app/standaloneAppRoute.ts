import { APP_MANIFESTS, type WindowAppId } from "../src/platform/apps/appManifest";
import { createInitialWindowInstanceManagerState, singletonWindowInstanceId, windowInstanceReducer } from "../src/platform/windows/windowInstanceState";

export function standaloneAppRoute(search: string): WindowAppId | null {
  const app = new URLSearchParams(search).get("app");
  return Object.keys(APP_MANIFESTS).find(id => id === app) as WindowAppId | undefined ?? null;
}

export function sharedAppWindowState(app: WindowAppId | null) {
  const state = createInitialWindowInstanceManagerState();
  if (app === null) return state;
  const id = singletonWindowInstanceId(app);
  return windowInstanceReducer(windowInstanceReducer(state, { type: "open", id, app }), { type: "update", id, patch: { maximized: true } });
}
