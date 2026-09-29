export type StageCamera = "front" | "stands" | "wide";
export type ListeningScene = "concert" | "train" | "rain" | "vinyl" | "space";
export type StagePalette = "ice" | "violet" | "rose";
export type StageView = { scene: ListeningScene; camera: StageCamera; palette: StagePalette };
export type StageScore = { view: StageView };
export const openingView: StageView = { scene: "concert", camera: "stands", palette: "ice" };
export const sceneLabels: Record<ListeningScene, string> = {
  concert: "夜场演唱会", train: "海上列车", rain: "雨巷咖啡",
  vinyl: "黑胶档案", space: "月面电台",
};

export function readSharedStage(hash: string): StageScore | null {
  const value = new URLSearchParams(hash.slice(1)).get("stage");
  return value === null ? null : { view: (JSON.parse(value) as StageScore).view };
}
