import { createLocalStorageProvider } from "../../platform/storage/providers/localSettings";

export default createLocalStorageProvider(
  "reading",
  "阅读记录",
  4,
  (stats) => `${stats.entries} 项进度、书签与偏好`,
);
