import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { openingView, readSharedStage, type StageScore } from "../../src/apps/music/performance";
import { musicShareUrl } from "../../src/apps/music/sharing";
import { ListeningRoom } from "../../src/apps/music/ListeningRoom";
import { parseLyrics } from "../../src/apps/music/lyrics";

const score: StageScore = { view: { scene:"space",camera:"wide",palette:"violet" } };
describe("personal listening scene", () => {
  it("shares the selected scene, camera and lighting without director cues", () => {
    const url = new URL(musicShareUrl("public-catalog-id","https://nova.example",score));
    expect(readSharedStage(url.hash)).toEqual(score);
    expect(url.searchParams.get("song")).toBe("public-catalog-id");
    const previousData = { ...score, cues: [{time:42,effect:"blackout"}] };
    const shared = new URL(musicShareUrl("public-catalog-id","https://nova.example",previousData));
    expect(readSharedStage(shared.hash)).toEqual(score);
    expect(decodeURIComponent(shared.hash)).not.toContain("cues");
  });
  it.each(["train","rain","rooftop","vinyl","space"] as const)("renders %s with existing word progress", scene => {
    const html=renderToStaticMarkup(createElement(ListeningRoom,{
      view:{...openingView,scene},analyser:null,playing:false,title:"夜场",artist:"NOVA",cover:"",
      lyrics:parseLyrics("[00:01.00]<00:01.00>此刻<00:03.00>"),time:2,
    }));
    expect(html).toContain(`data-scene="${scene}"`);
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('--fill:50%');
  });
});
