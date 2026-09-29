import { appShareUrl } from "../../platform/apps/appShare";
import type { CatalogTrack, Track } from "./model";

export function musicShareUrl(id: string, origin: string) {
  const url = new URL(appShareUrl("music", origin));
  url.searchParams.set("song", id);
  return url.href;
}

export function shareableSong(track: Track, catalog: CatalogTrack[]) {
  return catalog.find((item) => item.audioHash === track.audioHash);
}
