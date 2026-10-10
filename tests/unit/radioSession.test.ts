import { describe, expect, it } from "vitest";
import { createRadioSession } from "../../src/apps/radio/radioSession";
import { radioShareUrl, sharedStationIndex } from "../../src/apps/radio/sharing";
import { RADIO_STATIONS } from "../../src/apps/radio/stations";
import { standaloneAppRoute } from "../../app/standaloneAppRoute";

describe("independent radio session", () => {
  it("keeps the pinned station, volume and playback after closing the window", () => {
    const session = createRadioSession();
    session.tune(3);
    session.update({ pinned: true, volume: 42, status: "playing" });
    const playing = session.getSnapshot();
    session.releaseWindow();
    expect(session.getSnapshot()).toBe(playing);
    session.togglePlayback();
    expect(session.getSnapshot()).toMatchObject({ stationIndex: 3, requested: false, status: "paused", volume: 42 });
  });

  it("removes the card without interrupting an open window, and stops when neither remains", () => {
    const session = createRadioSession();
    session.update({ pinned: true });
    session.tune(2);
    session.update({ pinned: false });
    expect(session.getSnapshot().requested).toBe(true);
    session.releaseWindow();
    expect(session.getSnapshot()).toMatchObject({ pinned: false, requested: false, status: "idle" });
  });

  it("shares one station and playback state with all subscribers", () => {
    const session = createRadioSession();
    const snapshots: unknown[] = [];
    const unsubscribe = session.subscribe(() => snapshots.push(session.getSnapshot()));
    session.tune(4);
    session.togglePlayback();
    unsubscribe();
    session.tune(5);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]).toMatchObject({ stationIndex: 4, requested: false });
  });
});

describe("station share links", () => {
  it("opens the radio app and selects the exact station for every catalog entry", () => {
    RADIO_STATIONS.forEach((station, index) => {
      const url = new URL(radioShareUrl(station.id, "https://nova.example"));
      expect(url.origin).toBe("https://nova.example");
      expect(standaloneAppRoute(url.search)).toBe("radio");
      expect(sharedStationIndex(url.search)).toBe(index);
      expect(url.searchParams.get("station")).toBe(station.id);
    });
  });

  it("does not resolve a missing or unknown station to a different shared station", () => {
    expect(sharedStationIndex("?app=radio")).toBe(-1);
    expect(sharedStationIndex("?app=radio&station=unknown")).toBe(-1);
  });
});
