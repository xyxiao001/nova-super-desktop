"use client";

import { musicDesktopSession } from "./musicDesktopSession";

export default function MusicApp() {
  return <div ref={musicDesktopSession.setSurface} style={{ height: "100%", minHeight: 0 }} />;
}
