import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readWorkspaceFile = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("application style loading", () => {
  it("keeps application styles out of the desktop entrypoints", async () => {
    const [layout, main] = await Promise.all([
      readWorkspaceFile("app/layout.tsx"),
      readWorkspaceFile("src/main.tsx"),
    ]);

    expect(layout).not.toContain('import "./reader.css"');
    expect(main).not.toContain('import "../app/reader.css"');
    expect(layout).not.toContain("productivity-apps.css");
    expect(layout).not.toContain("games-tools.css");
  });

  it("loads each style group from its lazy application modules", async () => {
    const [reader, notes, games] = await Promise.all([
      readWorkspaceFile("app/ReaderApp.tsx"),
      readWorkspaceFile("app/NotepadApp.tsx"),
      readWorkspaceFile("app/GameHall.tsx"),
    ]);

    expect(reader).toContain('import "./reader.css"');
    expect(notes).toContain('import "./productivity-apps.css"');
    expect(games).toContain('import "./games-tools.css"');
  });
});
