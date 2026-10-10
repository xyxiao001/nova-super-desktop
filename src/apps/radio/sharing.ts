import { appShareUrl } from "../../platform/apps/appShare";
import { RADIO_STATIONS } from "./stations";

export function radioShareUrl(stationId: string, origin: string) {
  const url = new URL(appShareUrl("radio", origin));
  url.searchParams.set("station", stationId);
  return url.href;
}

export function sharedStationIndex(search: string) {
  const id = new URLSearchParams(search).get("station");
  return RADIO_STATIONS.findIndex(station => station.id === id);
}
