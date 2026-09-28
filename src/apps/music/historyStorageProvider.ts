import {
  encodedSize,
  type StorageProvider,
} from "../../platform/storage/providers/types";
import {
  readListeningHistory,
  replaceListeningHistory,
  type ListeningDay,
} from "./listeningHistory";
const isHistory = (value: unknown): value is ListeningDay[] =>
  Array.isArray(value) &&
  value.every(
    (row) =>
      row &&
      typeof row.id === "string" &&
      typeof row.day === "string" &&
      typeof row.hash === "string" &&
      typeof row.title === "string" &&
      typeof row.artist === "string" &&
      typeof row.seconds === "number",
  );
const provider: StorageProvider = {
  id: "music-history",
  label: "私人听歌记录",
  displayOrder: 3.1,
  showWhenEmpty: true,
  description: (stats) => `${stats.entries} 条每日听歌记录，用于本地月报`,
  inspect: async () => {
    const rows = await readListeningHistory();
    return { entries: rows.length, bytes: encodedSize(rows) };
  },
  exportData: readListeningHistory,
  validateData: isHistory,
  restoreData: async (value) => {
    if (!isHistory(value)) throw new Error("无效的听歌记录备份");
    await replaceListeningHistory(value);
    window.dispatchEvent(new Event("nova-music-history-changed"));
  },
  clear: async () => {
    await replaceListeningHistory([]);
    window.dispatchEvent(new Event("nova-music-history-changed"));
  },
};
export default provider;
