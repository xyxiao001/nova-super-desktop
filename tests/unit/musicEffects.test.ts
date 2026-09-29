import { describe, expect, it, vi } from "vitest";
import { createListeningEffects } from "../../src/apps/music/listeningEffects";

function audioContext() {
  const param = () => ({value:0,setValueAtTime:vi.fn(),setTargetAtTime:vi.fn()});
  const node = () => ({connect:vi.fn((next) => next),disconnect:vi.fn(),gain:param(),frequency:param(),threshold:param(),ratio:param(),attack:param(),release:param(),start:vi.fn(),stop:vi.fn(),buffer:null,loop:false,type:""});
  return {
    currentTime:0,sampleRate:8000,
    createGain:vi.fn(node),createBiquadFilter:vi.fn(node),createDynamicsCompressor:vi.fn(node),createConvolver:vi.fn(node),createBufferSource:vi.fn(node),
    createBuffer:vi.fn((_channels:number,length:number) => ({getChannelData:() => new Float32Array(length)})),
  };
}
describe("listening sound effects", () => {
  it("keeps original audio on the bypass path without generating reverb", () => {
    const context=audioContext();
    const fx=createListeningEffects(context as unknown as AudioContext);
    fx.setSound("original");
    expect(context.createBuffer).not.toHaveBeenCalled();
    expect(context.createGain.mock.results[2].value.gain.setTargetAtTime).toHaveBeenLastCalledWith(1,0,.03);
  });
  it("creates different room impulses only when the selected room changes", () => {
    const context=audioContext();
    const fx=createListeningEffects(context as unknown as AudioContext);
    fx.setSound("livehouse");fx.setSound("livehouse");fx.setSound("hall");
    expect(context.createBuffer.mock.calls.map(call=>call[1])).toEqual([5600,20800]);
    fx.setSound("radio");
    expect(context.createBiquadFilter.mock.results[0].value.frequency.setValueAtTime).toHaveBeenLastCalledWith(420,0);
    fx.setSound("night");
    expect(context.createDynamicsCompressor.mock.results[0].value.threshold.setValueAtTime).toHaveBeenLastCalledWith(-28,0);
  });
  it("only generates rain while enabled and playing, and stops on pause or disposal", () => {
    const context=audioContext();
    const fx=createListeningEffects(context as unknown as AudioContext);
    fx.setRain(0,true);fx.setRain(.2,false);
    expect(context.createBufferSource).not.toHaveBeenCalled();
    fx.setRain(.2,true);fx.setRain(.4,true);
    expect(context.createBufferSource).toHaveBeenCalledTimes(1);
    fx.setRain(.4,false);
    expect(context.createBufferSource.mock.results[0].value.stop).toHaveBeenCalledOnce();
    fx.setRain(.3,true);fx.dispose();
    expect(context.createBufferSource.mock.results[1].value.stop).toHaveBeenCalledOnce();
  });
});
