import { describe, expect, it, vi } from "vitest";
import { moveShowTrack, showGain, scheduleShowGain } from "../../src/apps/music/show";
describe("playlist show",()=>{
  it("fades the song edges independently from the user's volume",()=>{
    expect(showGain(0,100,"fade")).toBe(0);
    expect(showGain(1,100,"fade")).toBe(.5);
    expect(showGain(50,100,"fade")).toBe(1);
    expect(showGain(99,100,"fade")).toBe(.5);
    expect(showGain(100,100,"fade")).toBe(0);
    expect(showGain(0,100,"continuous")).toBe(1);
    expect(showGain(0,100,"pause")).toBe(1);
  });
  it("reorders a setlist without modifying the original playlist",()=>{
    const ids=["opening","main","encore"];
    expect(moveShowTrack(ids,1,-1)).toEqual(["main","opening","encore"]);
    expect(moveShowTrack(ids,1,1)).toEqual(["opening","encore","main"]);
    expect(ids).toEqual(["opening","main","encore"]);
  });
  it("schedules fades on the audio clock, including seeking into the outro",()=>{
    const gain={cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()};
    scheduleShowGain(gain as unknown as AudioParam,99,100,10,"fade",true);
    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(10);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(.5,10);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0,11);
    gain.linearRampToValueAtTime.mockClear();
    scheduleShowGain(gain as unknown as AudioParam,1,100,20,"fade",false);
    expect(gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    scheduleShowGain(gain as unknown as AudioParam,0,3,30,"fade",true);
    expect(gain.linearRampToValueAtTime.mock.calls).toContainEqual([.75,31.5]);
  });
});
