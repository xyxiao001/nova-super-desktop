export const CITY_LOCATIONS = [
  { id: "entrance", label: "霓虹大道", position: [0, 2.4, 62], target: [0, 10, -45] },
  { id: "market", label: "地下市集", position: [0, 2.4, 8], target: [-4, 9, -48] },
  { id: "tower", label: "核心高塔", position: [0, 2.4, -64], target: [0, 24, -125] },
  { id: "sky", label: "俯瞰夜城", position: [66, 76, 95], target: [0, 8, -42] },
] as const;

export function walkCity(x: number, z: number, yaw: number, forward: number, side: number, distance: number) {
  const length = Math.hypot(forward, side);
  if (length === 0) return { x, z };
  return {
    x: Math.max(-11, Math.min(11, x + (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * distance / length)),
    z: Math.max(-137, Math.min(72, z + (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * distance / length)),
  };
}
