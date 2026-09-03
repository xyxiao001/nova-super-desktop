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

  it("keeps suggested actions behind buttons and routes them through WindowRuntime", async () => {
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

  it("executes deterministic local system commands before consulting AI", async () => {
    const layer = await readWorkspaceFile("src/shell/DesktopPetLayer.tsx");

    expect(layer).toContain('localReply.action?.execution === "immediate"');
    expect(layer).toContain("if (immediateAction) runAction(immediateAction)");
    expect(layer.indexOf("if (immediateAction)")).toBeLessThan(
      layer.indexOf("readAiConnectionState()"),
    );
  });

  it("links reading and focus milestones without sending content to AI", async () => {
    const [reader, focus, layer] = await Promise.all([
      readWorkspaceFile("src/apps/reader/entry.tsx"),
      readWorkspaceFile("src/apps/focus/entry.tsx"),
      readWorkspaceFile("src/shell/DesktopPetLayer.tsx"),
    ]);

    expect(reader).toContain('publishNovaActivityEvent("reading-started", "reader"');
    expect(reader).toContain('publishNovaActivityEvent("reading-milestone", "reader"');
    expect(reader).toContain("localResourceId: activeBook.id");
    expect(reader).not.toContain("requestOpenAiCompletion");
    expect(focus).toContain('publishNovaActivityEvent(next ? "focus-started" : "focus-ended", "focus")');
    expect(focus).toContain('publishNovaActivityEvent("focus-completed", "focus"');
    expect(focus).not.toContain("requestOpenAiCompletion");
    expect(layer).toContain("petActivityFeedback(latestActivity)");
    expect(layer).toContain('className="pet-activity-feedback"');
  });

  it("links creative saves and keeps their payload content-free", async () => {
    const [photo, drawing] = await Promise.all([
      readWorkspaceFile("src/apps/photo/entry.tsx"),
      readWorkspaceFile("src/apps/drawing/entry.tsx"),
    ]);

    expect(photo).toContain('publishNovaActivityEvent("creative-saved","photo",{itemType:"image"})');
    expect(photo).toContain("const saved=onSave");
    expect(photo).toContain("if(saved)publishNovaActivityEvent");
    expect(drawing).toContain('publishNovaActivityEvent("creative-saved","drawing",{itemType:"image"})');
    expect(photo).not.toContain('publishNovaActivityEvent("creative-saved","photo",{content');
    expect(drawing).not.toContain('publishNovaActivityEvent("creative-saved","drawing",{content');
  });

  it("supports stopping streamed replies and direct local pet interactions", async () => {
    const [layer, styles] = await Promise.all([
      readWorkspaceFile("src/shell/DesktopPetLayer.tsx"),
      readWorkspaceFile("src/shell/desktopPet.css"),
    ]);

    expect(layer).toContain("const requestAbortRef = useRef<AbortController | null>(null)");
    expect(layer).toContain("signal: requestController.signal");
    expect(layer).toContain('aria-label="停止生成"');
    expect(layer).toContain("requestAbortRef.current?.abort()");
    expect(layer).toContain('"pet-interacted"');
    expect(layer).toContain("PET_INTERACTIONS.map");
    expect(styles).toContain(".desktop-pet.pet-draw .cat-action-prop");
    expect(styles).toContain(".desktop-pet.pet-nuzzle");
    expect(styles).toContain(".desktop-pet.pet-pounce");
  });
});
