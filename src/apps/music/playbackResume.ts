// Keep the requested position until the new source has media metadata.
// A source change cancels it, so a late event cannot seek a different song.
export function createPlaybackResume(audio: HTMLAudioElement) {
  let pending: number | undefined;
  const apply = () => {
    if (pending === undefined) return;
    audio.currentTime = pending;
    pending = undefined;
  };
  audio.addEventListener("loadedmetadata", apply);
  return {
    seekWhenReady(time: number) {
      pending = time;
      if (audio.readyState >= 1) apply();
    },
    position: () => pending ?? (audio.ended ? 0 : audio.currentTime),
    clear: () => { pending = undefined; },
    dispose: () => audio.removeEventListener("loadedmetadata", apply),
  };
}
