import { appShareUrl } from "../../platform/apps/appShare";
import type { CatalogTrack, Track } from "./model";
import type { StageScore } from "./performance";

export function musicShareUrl(id: string, origin: string, stage?: StageScore) {
  const url = new URL(appShareUrl("music", origin));
  url.searchParams.set("song", id);
  if (stage) url.hash = new URLSearchParams({ stage: JSON.stringify({ view: stage.view }) }).toString();
  return url.href;
}

export function shareableSong(track: Track, catalog: CatalogTrack[]) {
  return catalog.find((item) => item.audioHash === track.audioHash);
}
