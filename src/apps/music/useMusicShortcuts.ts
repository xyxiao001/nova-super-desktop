import { useEffect, useRef } from "react";
import type { Player } from "./usePlayer";

type MusicKey = Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "isComposing">;
export function musicKeyAction(event: MusicKey) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
  switch (event.code) {
    case "Space": return event.repeat ? undefined : "toggle";
    case "ArrowLeft": return "rewind";
    case "ArrowRight": return "forward";
    case "ArrowUp": return "louder";
    case "ArrowDown": return "quieter";
  }
}

export function useMusicShortcuts(active: boolean, player: Player, volume: number, setVolume: (value: number) => void) {
  const latest = useRef({ player, volume, setVolume });
  latest.current = { player, volume, setVolume };
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]')) return;
      const action = musicKeyAction(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      const { player, volume, setVolume } = latest.current;
      if (action === "toggle") player.toggle();
      else if (action === "rewind" || action === "forward") {
        player.seek(Math.min(player.duration, Math.max(0, player.time + (action === "forward" ? 5 : -5))));
      } else {
        setVolume(Math.min(1, Math.max(0, volume + (action === "louder" ? 0.05 : -0.05))));
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active]);
}
