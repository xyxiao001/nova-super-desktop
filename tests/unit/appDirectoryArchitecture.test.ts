import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { APP_MANIFESTS } from "../../src/platform/apps/appManifest";

const readWorkspaceFile = (path: string) =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("application directory architecture", () => {
  it("loads every application from its own default entry", async () => {
    const manifest = await readWorkspaceFile("src/platform/apps/appManifest.ts");

    for (const appId of Object.keys(APP_MANIFESTS)) {
      const entry = await readWorkspaceFile(`src/apps/${appId}/entry.tsx`);
      expect(entry).toContain("export default");
      expect(manifest).toContain(`import("../../apps/${appId}/entry")`);
    }
  });

  it("keeps application styles local to application directories", async () => {
    const appIds = Object.keys(APP_MANIFESTS);
    const entries = await Promise.all(
      appIds.map((appId) => readWorkspaceFile(`src/apps/${appId}/entry.tsx`)),
    );
    const [globals, desktop] = await Promise.all([
      readWorkspaceFile("app/globals.css"),
      readWorkspaceFile("app/desktop.css"),
    ]);

    expect(entries.every((entry) => /import "\.\/[^"]+\.css"/.test(entry))).toBe(true);
    expect(entries.join("\n")).not.toContain("productivity-apps.css");
    expect(entries.join("\n")).not.toContain("games-tools.css");
    expect(globals).not.toContain(".editor-shell");
    expect(globals).not.toContain(".photo-adjust");
    expect(desktop).not.toContain(".editor-shell");
  });

  it("leaves the route directory free of application components", async () => {
    const files = await readdir(new URL("../../app", import.meta.url));
    expect(files.some((file) => /(?:App|Game)\\.tsx$/.test(file))).toBe(false);
    expect(files).not.toContain("productivity-apps.css");
    expect(files).not.toContain("games-tools.css");
  });

  it("keeps ordinary application onboarding declarative", async () => {
    const [desktopRoot, windowFrame, appRegistry, manifest, providerRegistry, appFiles] = await Promise.all([
      readWorkspaceFile("src/shell/DesktopRoot.tsx"),
      readWorkspaceFile("src/shell/WindowFrame.tsx"),
      readWorkspaceFile("src/platform/apps/appRegistry.ts"),
      readWorkspaceFile("src/platform/apps/appManifest.ts"),
      readWorkspaceFile("src/platform/storage/providers/registry.ts"),
      readdir(new URL("../../app", import.meta.url)),
    ]);

    expect(desktopRoot).toContain("allWindowInstances(windowInstances).map");
    expect(desktopRoot).not.toContain("<WindowFrame");
    expect(windowFrame).not.toContain("WINDOW_MINIMUMS");
    expect(appRegistry).toContain("Object.keys(APP_MANIFESTS)");
    expect(manifest).toContain("storageProviders: [() => import");
    expect(manifest).toContain("resourcePackages:");
    expect(providerRegistry).not.toMatch(/gamesProvider|readerProvider|calendarProvider|focusProvider|settingsProvider/);
    expect(appFiles).not.toContain("lazyApps.ts");
  });
});
