import type { WindowInstanceAction, WindowInstanceId } from "../platform/windows/windowInstanceState";

export function pairWorkspaceWindows(left: WindowInstanceId, right: WindowInstanceId): WindowInstanceAction[] {
  return [
    { type: "focus", id: left },
    { type: "snap", id: left, mode: "left" },
    { type: "focus", id: right },
    { type: "snap", id: right, mode: "right" },
  ];
}
