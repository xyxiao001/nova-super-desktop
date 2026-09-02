import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DesktopItem } from "../../app/desktopFiles";
import {
  LaunchRuntimeProvider,
  useAppLaunchIntent,
} from "../../src/platform/launch/LaunchRuntime";
import {
  WindowInstanceProvider,
  useWindowInstance,
} from "../../src/platform/windows/WindowRuntime";
import {
  WorkspaceRuntimeProvider,
  useWorkspaceRuntime,
  type WorkspaceRuntimeValue,
} from "../../src/platform/workspace/WorkspaceRuntime";

describe("platform runtimes", () => {
  it("exposes the existing workspace value without owning a copy", () => {
    const items: DesktopItem[] = [];
    const value = { items } as WorkspaceRuntimeValue;
    let observed: DesktopItem[] | undefined;

    function Probe() {
      observed = useWorkspaceRuntime().items;
      return null;
    }

    renderToStaticMarkup(
      jsx(WorkspaceRuntimeProvider, {
        value,
        children: jsx(Probe, {}),
      }),
    );

    expect(observed).toBe(items);
  });

  it("selects and acknowledges launch intents through LaunchRuntime", () => {
    const markHandled = vi.fn();
    let requestId: number | undefined;
    let targetItemId: string | undefined;
    let acknowledge: ((requestId: number) => void) | undefined;

    function Probe() {
      const runtime = useAppLaunchIntent("reader");
      targetItemId = useWindowInstance().target?.itemId;
      requestId = runtime.launchIntent?.requestId;
      acknowledge = runtime.onLaunchHandled;
      return null;
    }

    renderToStaticMarkup(
      jsx(LaunchRuntimeProvider, {
        value: {
          intents: {
            "reader:main": {
              app: "reader",
              kind: "book",
              bookId: "book-1",
              requestId: 7,
            },
          },
          markHandled,
        },
        children: jsx(WindowInstanceProvider, {
          value: {
            id: "reader:main",
            app: "reader",
            target: { kind: "text", itemId: "note-1" },
          },
          children: jsx(Probe, {}),
        }),
      }),
    );
    acknowledge?.(requestId!);

    expect(requestId).toBe(7);
    expect(targetItemId).toBe("note-1");
    expect(markHandled).toHaveBeenCalledWith("reader:main", 7);
  });
});
