import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DesktopItem } from "../../app/desktopFiles";
import {
  LaunchRuntimeProvider,
  useAppLaunchIntent,
} from "../../src/platform/launch/LaunchRuntime";
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
    let acknowledge: ((requestId: number) => void) | undefined;

    function Probe() {
      const runtime = useAppLaunchIntent("reader");
      requestId = runtime.launchIntent?.requestId;
      acknowledge = runtime.onLaunchHandled;
      return null;
    }

    renderToStaticMarkup(
      jsx(LaunchRuntimeProvider, {
        value: {
          intent: { app: "reader", kind: "book", bookId: "book-1", requestId: 7 },
          markHandled,
        },
        children: jsx(Probe, {}),
      }),
    );
    acknowledge?.(requestId!);

    expect(requestId).toBe(7);
    expect(markHandled).toHaveBeenCalledWith(7);
  });
});
