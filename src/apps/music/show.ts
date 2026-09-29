export type ShowRole = "opening" | "main" | "encore";
export type ShowTransition = "continuous" | "pause" | "fade";
export type PlaylistShow = { title: string; transition: ShowTransition; roles: Record<string, ShowRole> };
export type ActiveShow = PlaylistShow & { tracks: string[] };
export const roleLabels: Record<ShowRole,string> = { opening:"开场", main:"主场", encore:"安可" };
export const transitionLabels: Record<ShowTransition,string> = { continuous:"原曲衔接", pause:"曲间留白 · 2 秒", fade:"淡出淡入 · 2 秒" };
export function showGain(time: number, duration: number, transition: ShowTransition) {
  return transition === "fade" ? Math.max(0,Math.min(1,time / 2,(duration - time) / 2)) : 1;
}
export function scheduleShowGain(gain: AudioParam, time: number, duration: number, now: number, transition: ShowTransition, playing: boolean) {
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(showGain(time,duration,transition),now);
  if (transition !== "fade" || !playing) return;
  for (const point of [...new Set([2,duration / 2,duration - 2,duration])].filter(point=>point>time).sort((a,b)=>a-b)) {
    gain.linearRampToValueAtTime(showGain(point,duration,transition),now + point - time);
  }
}
export function moveShowTrack(ids: string[], index: number, direction: -1 | 1) {
  const result=[...ids];
  [result[index],result[index+direction]]=[result[index+direction],result[index]];
  return result;
}
