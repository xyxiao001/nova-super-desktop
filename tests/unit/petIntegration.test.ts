import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readWorkspaceFile = (path: string) => (
  readFile(new URL(`../../${path}`, import.meta.url), "utf8")
);

describe("desktop pet integration", () => {
  it("hosts pet state above the shell and renders the pet outside application windows", async () => {
    const root = await readWorkspaceFile("src/shell/DesktopRoot.tsx");

    expect(root).toContain("<PetRuntimeProvider>");
    expect(root).toContain("<DesktopPetLayer maximizedWindow={taskbarAutoHide} windowOpen={mobileWindowOpen}/>");
    expect(root.indexOf("<DesktopPetLayer")).toBeLessThan(root.indexOf("allWindowInstances(windowInstances).map"));
    expect(root).toContain(".desktop-pet-layer");
  });

  it("keeps the desktop layer transparent outside explicit pet controls", async () => {
    const [layer, styles] = await Promise.all([
      readWorkspaceFile("src/shell/DesktopPetLayer.tsx"),
      readWorkspaceFile("src/shell/desktopPet.css"),
    ]);

    expect(styles).toContain(".desktop-pet-layer { position:absolute; z-index:10;");
    expect(styles).toContain("pointer-events:none");
    expect(styles).toContain(".desktop-pet {");
    expect(styles).toContain("pointer-events:auto");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(layer).toContain("if (!data || !data.preferences.enabled) return null");
    expect(layer).toContain("setPointerCapture");
    expect(layer).toContain("void setPosition(draftPosition.x, draftPosition.y)");
    expect(layer).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(layer).toContain("&& !reducedMotion");
  });

  it("exposes creation and local controls through the settings app", async () => {
    const [settings, petSettings] = await Promise.all([
      readWorkspaceFile("src/apps/settings/entry.tsx"),
      readWorkspaceFile("src/apps/settings/PetSettings.tsx"),
    ]);

    expect(settings).toContain('{id:"pet",label:"伙伴"');
    expect(settings).toContain('activePane==="pet"&&<PetSettings/>');
    expect(settings).toContain("clearPetData()");
    expect(petSettings).toContain("创建伙伴");
    expect(petSettings).toContain("启用桌面伙伴");
    expect(petSettings).toContain("回到默认位置");
    expect(petSettings).toContain("不影响 AI 配置");
  });

  it("keeps local dialogue actions behind explicit buttons", async () => {
    const [layer, root] = await Promise.all([
      readWorkspaceFile("src/shell/DesktopPetLayer.tsx"),
      readWorkspaceFile("src/shell/DesktopRoot.tsx"),
    ]);

    expect(layer).toContain("createLocalPetReply");
    expect(layer).toContain("useWindowRuntime");
    expect(layer).toContain("onClick={() => runAction(action)}");
    expect(layer).toContain("openApp(action.app)");
    expect(root).toContain('publishNovaActivityEvent("app-activated",app)');
  });
});
