import { describe, expect, it } from "vitest";

import {
  defaultFileOpenApp,
  fileOpenOptions,
} from "../../app/fileAssociations";

describe("file associations", () => {
  it("uses one primary application for each desktop item type", () => {
    expect(defaultFileOpenApp("folder")).toBe("explorer");
    expect(defaultFileOpenApp("text")).toBe("notes");
    expect(defaultFileOpenApp("image")).toBe("viewer");
  });

  it("offers the photo viewer and editor for images", () => {
    expect(fileOpenOptions("image")).toEqual([
      { app: "viewer", label: "照片", primary: true },
      { app: "photo", label: "照片实验室", primary: false },
    ]);
  });
});
