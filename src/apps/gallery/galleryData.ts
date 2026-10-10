export const GALLERY_WORKS = [
  { id: 436535, title: "麦田与柏树", artist: "文森特·梵高", note: "风掠过麦田，也掠过日常。" },
  { id: 45434, title: "神奈川冲浪里", artist: "葛饰北斋", note: "把海浪的一瞬，留在桌面。" },
  { id: 436528, title: "鸢尾花", artist: "文森特·梵高", note: "让一束蓝紫色，开在今天。" },
  { id: 436105, title: "苏格拉底之死", artist: "雅克-路易·大卫", note: "在安静的片刻，走近一段历史。" },
  { id: 436532, title: "戴草帽的自画像", artist: "文森特·梵高", note: "透过笔触，与画家对望。" },
  { id: 459055, title: "天使报喜", artist: "汉斯·梅姆林", note: "细节里，藏着另一个时代。" },
  { id: 437984, title: "摇篮曲", artist: "文森特·梵高", note: "一把椅子，一段安宁的时光。" },
] as const;
export type GalleryArtwork = {
  objectID: number; title: string; artistDisplayName: string; objectDate: string;
  primaryImage: string; primaryImageSmall: string; medium: string; dimensions: string;
  objectURL: string; creditLine: string; isPublicDomain: boolean;
};
export const FRAME_STYLES = [{ id: "wood", label: "木框" }, { id: "instant", label: "拍立得" }, { id: "bare", label: "无边框" }] as const;
export type FrameStyle = typeof FRAME_STYLES[number]["id"];
export function dailyArtworkIndex(date: Date) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return day % GALLERY_WORKS.length;
}
export const artworkUrl = (index: number) => `https://collectionapi.metmuseum.org/public/collection/v1/objects/${GALLERY_WORKS[index].id}`;
