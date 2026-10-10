import Hls, { type LoadPolicy } from "hls.js";

const withoutRetries = (policy: LoadPolicy): LoadPolicy => ({
  default: { ...policy.default, timeoutRetry: null, errorRetry: null },
});

export function startHlsPlayback(
  audio: HTMLAudioElement,
  url: string,
  onReady: () => void,
  onFailure: () => void,
): () => void {
  const hls = new Hls({
    manifestLoadPolicy: withoutRetries(Hls.DefaultConfig.manifestLoadPolicy),
    playlistLoadPolicy: withoutRetries(Hls.DefaultConfig.playlistLoadPolicy),
    fragLoadPolicy: withoutRetries(Hls.DefaultConfig.fragLoadPolicy),
    keyLoadPolicy: withoutRetries(Hls.DefaultConfig.keyLoadPolicy),
    appendErrorMaxRetry: 0,
    nudgeMaxRetry: 0,
  });
  hls.on(Hls.Events.MANIFEST_PARSED, onReady);
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) {
      hls.stopLoad();
      onFailure();
    }
  });
  hls.attachMedia(audio);
  hls.loadSource(url);
  return () => hls.destroy();
}
