import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assetRoot = resolve("public/assets/games/frontline");

type ManifestFile = {
  path: string;
  bytes: number;
  sha256: string;
};

type FrontlineManifest = {
  sourceVersion: string;
  unityVersion: string;
  bundles: Array<{ file: string; bytes: number; sha256: string }>;
  spineActors: Array<{
    binaryVersion: string;
    runtime: { version: string; pipeline: string };
    animations: Array<{ name: string; duration: number }>;
    lifecycleAudit: { required: string[]; missing: string[] };
    files: Record<string, ManifestFile>;
  }>;
  effects: Array<{
    kind: string;
    files: Record<string, ManifestFile>;
  }>;
};

const readManifest = async () => JSON.parse(
  await readFile(resolve(assetRoot, "manifest.json"), "utf8"),
) as FrontlineManifest;

const fileHash = async (path: string) => createHash("sha256")
  .update(await readFile(resolve(assetRoot, path)))
  .digest("hex");

describe("frontline extracted asset contract", () => {
  it("pins the source and compatible Spine runtime versions", async () => {
    const manifest = await readManifest();
    const actor = manifest.spineActors[0];

    expect(manifest.sourceVersion).toBe("412f11e3c27d645ddeafcf921f558d57");
    expect(manifest.unityVersion).toBe("2022.3.48t7");
    expect(actor.binaryVersion).toBe("4.2.33");
    expect(actor.runtime).toEqual({
      package: "@esotericsoftware/spine-webgl",
      version: "4.2.120",
      pipeline: "binary",
    });
  });

  it("records hashes and sizes for every extracted output", async () => {
    const manifest = await readManifest();
    const files = [
      ...Object.values(manifest.spineActors[0].files),
      ...Object.values(manifest.effects[0].files),
    ];

    for (const file of files) {
      const contents = await readFile(resolve(assetRoot, file.path));
      expect(contents.byteLength, file.path).toBe(file.bytes);
      expect(await fileHash(file.path), file.path).toBe(file.sha256);
    }
  });

  it("reports the source lifecycle animations without inventing hurt", async () => {
    const manifest = await readManifest();
    const actor = manifest.spineActors[0];
    const names = actor.animations.map((animation) => animation.name);

    expect(names).toEqual(["attack_1", "dead", "run", "stand"]);
    expect(actor.lifecycleAudit.required).toContain("hurt");
    expect(actor.lifecycleAudit.missing).toEqual(["hurt"]);
    expect(actor.animations.every((animation) => animation.duration > 0)).toBe(true);
  });

  it("exports the Unity particle flipbook contract", async () => {
    const manifest = await readManifest();
    const effect = manifest.effects[0];
    const config = JSON.parse(
      await readFile(resolve(assetRoot, effect.files.config.path), "utf8"),
    ) as {
      lifetime: number;
      maxParticles: number;
      textureSheet: { columns: number; rows: number; fps: number; cycles: number };
    };

    expect(effect.kind).toBe("unity-particle-flipbook");
    expect(config.lifetime).toBe(1);
    expect(config.maxParticles).toBe(1);
    expect(config.textureSheet).toEqual({
      columns: 5,
      rows: 4,
      fps: 30,
      cycles: 1,
    });
  });
});
