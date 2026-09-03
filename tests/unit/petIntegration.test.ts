import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readWorkspaceFile = (path: string) => (
  readFile(new URL(`../../${path}`, import.meta.url), "utf8")
);

describe("desktop pet integration", () => {
  it("hosts pet state above the shell and renders the pet outside application windows", async () => {
    const root = await readWorkspaceFile("src/shell/DesktopRoot.tsx");

    expect(root).toContain("<PetRuntimeProvider>");
    expect(root).toContain('<DesktopPetLayer desktopActive={focused==="desktop"} maximizedWindow={taskbarAutoHide} windowOpen={mobileWindowOpen}/>');
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

  it("creates a default companion and exposes reset and local controls", async () => {
    const [settings, petSettings, runtime] = await Promise.all([
      readWorkspaceFile("src/apps/settings/entry.tsx"),
      readWorkspaceFile("src/apps/settings/PetSettings.tsx"),
      readWorkspaceFile("src/platform/pet/PetRuntime.tsx"),
    ]);

    expect(settings).toContain('{id:"pet",label:"伙伴"');
    expect(settings).toContain('activePane==="pet"&&<PetSettings/>');
    expect(settings).toContain("clearPetData()");
    expect(runtime).toContain("const created = createDefaultPetData()");
    expect(runtime).toContain("await savePetData(created)");
    expect(runtime).toContain("const next = createDefaultPetData()");
    expect(petSettings).toContain("重置桌面伙伴");
    expect(petSettings).toContain("启用桌面伙伴");
    expect(petSettings).toContain("回到默认位置");
    expect(petSettings).toContain("不会删除 AI 连接配置");
  });

  it("[defect-probing] isolates stale runtime writes before resetting the companion", async () => {
    const runtime = await readWorkspaceFile("src/platform/pet/PetRuntime.tsx");
    const resetStart = runtime.indexOf("const resetPet = useCallback");
    const resetEnd = runtime.indexOf("const value = useMemo", resetStart);
    const resetImplementation = runtime.slice(resetStart, resetEnd);

    expect(resetImplementation).toContain("resettingRef.current = true");
    expect(resetImplementation).toContain("dataRef.current = null");
    expect(resetImplementation.indexOf("dataRef.current = null")).toBeLessThan(
      resetImplementation.indexOf("await storageQueueRef.current?.reset(next)"),
    );
    expect(runtime).toContain("if (resettingRef.current) return");
    expect(runtime).toContain("createPetRuntimeStorageQueue");
  });

  it("[defect-probing] focuses the desktop when its background receives pointer input", async () => {
    const root = await readWorkspaceFile("src/shell/DesktopRoot.tsx");
    const mainStart = root.indexOf("<main");
    const pointerUp = root.indexOf(" onPointerUp=", mainStart);
    const mainPointerDown = root.slice(mainStart, pointerUp);

    expect(mainPointerDown).toContain("focusDesktop()");
    expect(mainPointerDown).toContain("shouldFocusDesktopFromTarget(target)");
  });

  it("runs proactive local moments only while the desktop is active and visible", async () => {
    const [layer, ambient, styles] = await Promise.all([
      readWorkspaceFile("src/shell/DesktopPetLayer.tsx"),
      readWorkspaceFile("app/petAmbient.ts"),
      readWorkspaceFile("src/shell/desktopPet.css"),
    ]);

    expect(layer).toContain("desktopActive");
    expect(layer).toContain('document.visibilityState !== "visible"');
    expect(layer).toContain('document.addEventListener("visibilitychange", handleVisibility)');
    expect(layer).toContain("PET_AMBIENT_IDLE_MS[ambientFrequency]");
    expect(layer).toContain("createPetAmbientMoment");
    expect(ambient).not.toContain("requestOpenAiCompletion");
    expect(styles).toContain(".desktop-pet.pet-rest");
    expect(styles).toContain(".desktop-pet.pet-groom");
    expect(styles).toContain(".desktop-pet.pet-bathe");
    expect(styles).toContain(".desktop-pet.pet-stretch");
  });

  it("gates AI-enhanced ambient lines behind consent and fixed budgets", async () => {
    const [layer, settings, proactive] = await Promise.all([
      readWorkspaceFile("src/shell/DesktopPetLayer.tsx"),
      readWorkspaceFile("src/apps/settings/AiConnectionSettings.tsx"),
      readWorkspaceFile("app/petProactiveAi.ts"),
    ]);

    expect(settings).toContain("AI 主动陪伴");
    expect(settings).toContain("每次最多 48 tokens");
    expect(layer).toContain("getProactiveAiConnection");
    expect(layer).toContain("canRequestProactiveAi");
    expect(layer).toContain("ambientAiAbortRef.current?.abort()");
    expect(proactive).toContain("PROACTIVE_AI_MAX_REQUESTS_PER_SESSION = 2");
    expect(proactive).toContain("PROACTIVE_AI_COOLDOWN_MS = 30 * 60_000");
    expect(proactive).toContain("allowWebSearch: false");
    expect(proactive).not.toContain("activitySummary");
    expect(proactive).not.toContain("resourceNames");
  });

  it("publishes content-free file operation events from successful shell actions", async () => {
    const root = await readWorkspaceFile("src/shell/DesktopRoot.tsx");

    expect(root).toContain('publishNovaActivityEvent("file-created","desktop",{itemType:"folder",count:1})');
    expect(root).toContain('publishNovaActivityEvent("note-created","notes",{itemType:"text",count:1})');
    expect(root).toContain('publishNovaActivityEvent("excerpt-created","reader",{itemType:"text",count:1})');
    expect(root).toContain('publishNovaActivityEvent("files-organized","desktop",{operation:"trash"');
    expect(root).toContain('publishNovaActivityEvent("files-organized","desktop",{operation:mode');
    expect(root).not.toContain('publishNovaActivityEvent("file-created","desktop",{content');
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
