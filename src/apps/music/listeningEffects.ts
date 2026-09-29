export type SoundPreset = "original" | "livehouse" | "hall" | "radio" | "night";
export const soundLabels: Record<SoundPreset, string> = {
  original: "原声", livehouse: "Livehouse", hall: "音乐厅", radio: "复古电台", night: "深夜聆听",
};
export const soundSettings = {
  original: { low: 20000, high: 20, threshold: 0, ratio: 1, dry: 0, wet: 0, decay: 0 },
  livehouse: { low: 16000, high: 40, threshold: 0, ratio: 1, dry: .9, wet: .16, decay: .7 },
  hall: { low: 18000, high: 30, threshold: 0, ratio: 1, dry: .85, wet: .23, decay: 2.6 },
  radio: { low: 3400, high: 420, threshold: -20, ratio: 3, dry: 1, wet: 0, decay: 0 },
  night: { low: 18000, high: 35, threshold: -28, ratio: 4, dry: 1, wet: 0, decay: 0 },
} satisfies Record<SoundPreset, object>;

export function createListeningEffects(context: AudioContext) {
  const input = context.createGain();
  const output = context.createGain();
  const bypass = context.createGain();
  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  const compressor = context.createDynamicsCompressor();
  compressor.attack.value = .015;
  compressor.release.value = .3;
  const treated = context.createGain();
  const reverb = context.createConvolver();
  const wet = context.createGain();
  const rainGain = context.createGain();
  const rainFilter = context.createBiquadFilter();
  rainFilter.type = "lowpass";
  rainFilter.frequency.value = 3000;
  let rainSource: AudioBufferSourceNode | null = null;
  let preset: SoundPreset | null = null;

  input.connect(bypass).connect(output);
  input.connect(highpass).connect(lowpass).connect(compressor);
  compressor.connect(treated).connect(output);
  compressor.connect(reverb).connect(wet).connect(output);
  rainFilter.connect(rainGain).connect(output);
  treated.gain.value = 0;
  wet.gain.value = 0;
  rainGain.gain.value = 0;

  const setSound = (value: SoundPreset) => {
    if (preset === value) return;
    preset = value;
    const settings = soundSettings[value];
    const now = context.currentTime;
    bypass.gain.setTargetAtTime(value === "original" ? 1 : 0, now, .03);
    treated.gain.setTargetAtTime(settings.dry, now, .03);
    wet.gain.setTargetAtTime(settings.wet, now, .03);
    highpass.frequency.setValueAtTime(settings.high, now);
    lowpass.frequency.setValueAtTime(settings.low, now);
    compressor.threshold.setValueAtTime(settings.threshold, now);
    compressor.ratio.setValueAtTime(settings.ratio, now);
    if (settings.decay) {
      const length = Math.floor(context.sampleRate * settings.decay);
      const impulse = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
      reverb.buffer = impulse;
    }
  };
  const setRain = (volume: number, playing: boolean) => {
    rainGain.gain.setTargetAtTime(volume * .3, context.currentTime, .1);
    if (volume > 0 && playing && !rainSource) {
      const noise = context.createBuffer(2, context.sampleRate * 3, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = noise.getChannelData(channel);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      rainSource = context.createBufferSource();
      rainSource.buffer = noise;
      rainSource.loop = true;
      rainSource.connect(rainFilter);
      rainSource.start();
    } else if ((volume === 0 || !playing) && rainSource) {
      rainSource.stop();
      rainSource.disconnect();
      rainSource = null;
    }
  };
  return {
    input, output, setSound, setRain,
    dispose: () => {
      if (rainSource) { rainSource.stop(); rainSource.disconnect(); }
      for (const node of [input, output, bypass, highpass, lowpass, compressor, treated, reverb, wet, rainFilter, rainGain]) node.disconnect();
    },
  };
}
