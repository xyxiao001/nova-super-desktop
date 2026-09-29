export type StageCamera = "front" | "stands" | "wide";
export type ListeningScene = "concert" | "train" | "rain" | "rooftop" | "vinyl" | "space";
export type StagePalette = "ice" | "violet" | "rose";
export type StageView = { scene: ListeningScene; camera: StageCamera; palette: StagePalette };
export type StageScore = { view: StageView };
export const openingView: StageView = { scene: "concert", camera: "stands", palette: "ice" };
export const sceneLabels: Record<ListeningScene, string> = {
  concert: "夜场演唱会", train: "深夜列车", rain: "雨天房间",
  rooftop: "天台夜景", vinyl: "黑胶听音室", space: "宇宙漂流",
};

export function readSharedStage(hash: string): StageScore | null {
  const value = new URLSearchParams(hash.slice(1)).get("stage");
  return value === null ? null : { view: (JSON.parse(value) as StageScore).view };
}
