import type { Track } from "./model";

export function publishMediaTrack(
  session: MediaSession,
  track: Pick<Track, "title" | "artist" | "album" | "cover">,
) {
  const artworkUrl = track.cover ? URL.createObjectURL(track.cover) : null;
  session.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: artworkUrl ? [{ src: artworkUrl, type: track.cover!.type }] : [],
  });
  return () => {
    session.metadata = null;
    if (artworkUrl) URL.revokeObjectURL(artworkUrl);
  };
}

export function connectMediaSession(
  audio: HTMLAudioElement,
  session: MediaSession,
  actions: {
    play: () => void;
    pause: () => void;
    previous: () => void;
    next: () => void;
    seek: (time: number) => void;
  },
) {
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", actions.play],
    ["pause", actions.pause],
    ["previoustrack", actions.previous],
    ["nexttrack", actions.next],
    ["seekto", (details) => actions.seek(details.seekTime!)],
  ];
  for (const [action, handler] of handlers) session.setActionHandler(action, handler);

  const position = () => {
    // The native duration is unavailable while a new audio source is loading.
    if (Number.isFinite(audio.duration) && audio.duration > 0)
      session.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: audio.currentTime,
      });
  };
  const play = () => { session.playbackState = "playing"; };
  const pause = () => { session.playbackState = "paused"; };
  const empty = () => {
    session.playbackState = "none";
    session.setPositionState();
  };
  const listeners: [string, () => void][] = [
    ["play", play], ["pause", pause], ["emptied", empty],
    ["loadedmetadata", position], ["timeupdate", position], ["seeked", position],
  ];
  for (const [event, listener] of listeners) audio.addEventListener(event, listener);
  return () => {
    for (const [event, listener] of listeners) audio.removeEventListener(event, listener);
    for (const [action] of handlers) session.setActionHandler(action, null);
    empty();
  };
}
