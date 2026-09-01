import { createLocalStorageProvider } from "../../platform/storage/providers/localSettings";

export default createLocalStorageProvider(
  "focus",
  "专注记录",
  5,
  (stats) => `${stats.entries} 项专注历史`,
);
