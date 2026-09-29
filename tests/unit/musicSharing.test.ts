import { describe, expect, it } from "vitest";
import { standaloneAppRoute } from "../../app/standaloneAppRoute";
import { musicShareUrl, shareableSong } from "../../src/apps/music/sharing";
import type { CatalogTrack, Track } from "../../src/apps/music/model";

describe("online song sharing", () => {
  it("opens the music app and preserves the exact catalog identity", () => {
    const id = "七里香 & live/1";
    const url = new URL(musicShareUrl(id, "https://nova.example/?file=private#draft"));
    expect(standaloneAppRoute(url.search)).toBe("music");
    expect([...url.searchParams]).toEqual([["app", "music"], ["song", id]]);
    expect(url.hash).toBe("");
  });

  const catalog = [{ id: "online-song", audioHash: "same-audio", title: "歌曲" }] as CatalogTrack[];
  it("shares the public catalog identity even when deduplication keeps a local ID", () => {
    const local = { id: "private-local-id", audioHash: "same-audio", source: "local" } as Track;
    expect(shareableSong(local, catalog)?.id).toBe("online-song");
    expect(musicShareUrl(shareableSong(local, catalog)!.id, "https://nova.example")).not.toContain(local.id);
  });
  it("does not create online links for private files outside the catalog", () => {
    expect(shareableSong({ audioHash: "private-recording" } as Track, catalog)).toBeUndefined();
  });
});
