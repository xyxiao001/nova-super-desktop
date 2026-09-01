import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assetUrl = (name: string) => new URL(
  `../../public/games/youtd2/${name}`,
  import.meta.url,
);

describe("YouTD 2 Web export", () => {
  it("includes every runtime file loaded by the Godot shell", () => {
    expect(statSync(assetUrl("index.pck")).size).toBe(125_256_848);
    expect(statSync(assetUrl("index.wasm")).size).toBe(1_620_216);
    expect(statSync(assetUrl("index.side.wasm")).size).toBe(39_753_646);
    expect(statSync(assetUrl("index.audio.worklet.js")).size).toBe(7_298);
  });

  it("keeps the threaded runtime companions discoverable", () => {
    const loader = readFileSync(assetUrl("index.js"), "utf8");
    expect(loader).toContain("`${loadPath}.side.wasm`");
    expect(loader).toContain("`${loadPath}.audio.worklet.js`");
  });
});
