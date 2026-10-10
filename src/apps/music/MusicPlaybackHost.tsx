"use client";

import { WindowInstanceProvider } from "../../platform/windows/WindowRuntime";
import MusicSession from "./MusicSession";
import { useMusicDesktopSession } from "./musicDesktopSession";

export default function MusicPlaybackHost() {
  const { surface, pinned } = useMusicDesktopSession();
  return surface || pinned ? <WindowInstanceProvider value={{ id: "music:main", app: "music" }}><MusicSession /></WindowInstanceProvider> : null;
}
