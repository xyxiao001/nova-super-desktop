import { createLocalStorageProvider } from "../../platform/storage/providers/localSettings";

export default createLocalStorageProvider(
  "settings",
  "桌面设置",
  6,
  (stats) => `${stats.entries} 项主题、布局与窗口位置`,
);
