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

type HeroUiManifest = {
  sourceVersion: string;
  bundles: Array<{ file: string; bytes: number; sha256: string }>;
  files: Array<{
    sourceBundle: string;
    sourceObject: string;
    width: number;
    height: number;
    file: ManifestFile;
  }>;
};

const readManifest = async () => JSON.parse(
  await readFile(resolve(assetRoot, "manifest.json"), "utf8"),
) as FrontlineManifest;

const readHeroUiManifest = async () => JSON.parse(
  await readFile(resolve(assetRoot, "ui/heroes/source-manifest.json"), "utf8"),
) as HeroUiManifest;

const readCampaignUiManifest = async () => JSON.parse(
  await readFile(resolve(assetRoot, "ui/campaign/source-manifest.json"), "utf8"),
) as HeroUiManifest;

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

  it("pins the fixed-version hero screen source bundles", async () => {
    const manifest = await readHeroUiManifest();

    expect(manifest.sourceVersion).toBe("412f11e3c27d645ddeafcf921f558d57");
    expect(manifest.bundles.map((bundle) => ({
      file: bundle.file,
      sha256: bundle.sha256,
    }))).toEqual([
      {
        file: "gui_common_raw_hero_background_6fe60a6e99502b6ceb3873d7dcba16ef",
        sha256: "c9236b42782dfc9ab004a9724e89b371b30ea58a1db719317543f7d39f254708",
      },
      {
        file: "gui_common_raw_hero_buzheng_beijing_cac3909cb10509b40de00dd74a5e97b7",
        sha256: "93a0af35289b70a8f68a76ce69bb9cb4701e73f6de09881c34c35b848e8e1912",
      },
      {
        file: "gui_common_raw_hero_qianghuadi_01_ce30ab6cbc6ff0edc3ca9eccb982aeca",
        sha256: "69fd33cd0e49c771a5b35a1b1aa86bc5aca9e746068221ce95fdad0e01c7eaa0",
      },
      {
        file: "gui_tex_warrior_ad30d9aea6299507c8a1a054bf1fcc58",
        sha256: "b0733e13d148e09588869658539298001ae59646730d3b608ed388b39482242f",
      },
      {
        file: "gui_common_tex_warriorskillicon_2527cc6ae35a5bd50bbe9ba21a02ba6f",
        sha256: "a6f0aa0e7dd084d060beb85bdf7eb90efcc05ad73972a3335e551f7a9682b6ad",
      },
      {
        file: "gui_common_tex_warriorvocation_b709e8d3f93b9845a472af8a10b6cfc6",
        sha256: "49ae3bb897f846135add9021bda2a89930ad22d461bbae19f77d389bc678663a",
      },
      {
        file: "gui_common_tex_iconitem_swleechdom_903608687112c2701e45f491e79600f9",
        sha256: "68244398a266136135c3cf798c222327cdbc71c46b0852424166edd785748140",
      },
      {
        file: "gui_common_tex_commonimg_424035c415f59d9562bc82c009d3edd2",
        sha256: "3df7c22870005ad439ef2caf91e23575be69b7fb908bbd413308d7ea4b2c9c52",
      },
      {
        file: "gui_common_tex_cardbg_987a417fc0f36079cfa8327d012a5065",
        sha256: "b7628c54d4ee58071dd5a6e42b6ca52855ebe62dd271ef795d39b0c84613e31d",
      },
      {
        file: "gui_common_tex_icon_bust_a2be0b233df195a88f52f6d37b21194d",
        sha256: "e7ffac470441595f4bbdc0c629c89adbf9bdacd9940a8021ddb2a02fa0ed4e73",
      },
    ]);
  });

  it("records hashes and dimensions for every hero screen asset", async () => {
    const manifest = await readHeroUiManifest();
    expect(manifest.files).toHaveLength(62);
    expect(manifest.files.slice(0, 3).map((entry) => ({
      name: entry.sourceObject,
      width: entry.width,
      height: entry.height,
    }))).toEqual([
      { name: "Hero_background", width: 720, height: 577 },
      { name: "Hero_buzheng_beijing", width: 601, height: 273 },
      { name: "Hero_qianghuadi_01", width: 720, height: 361 },
    ]);

    for (const entry of manifest.files) {
      const path = `ui/heroes/${entry.file.path}`;
      const contents = await readFile(resolve(assetRoot, path));
      expect(contents.byteLength, path).toBe(entry.file.bytes);
      expect(await fileHash(path), path).toBe(entry.file.sha256);
    }
  });

  it("pins the fixed-version campaign screen source bundles", async () => {
    const manifest = await readCampaignUiManifest();

    expect(manifest.sourceVersion).toBe("412f11e3c27d645ddeafcf921f558d57");
    expect(manifest.bundles.map((bundle) => ({
      file: bundle.file,
      sha256: bundle.sha256,
    }))).toEqual([
      {
        file: "gui_mainline_main_background_01_f8d3ee575bbeffccb8f4402a0442762e",
        sha256: "b81fc2648c37c4b9adf5232ebcab19b76255d76fbf2f6462076fbffbead7c007",
      },
      {
        file: "gui_mainline_97f0e7d83537ebdac5c94c270da8f374",
        sha256: "3950bb2d71b6f44c6e0226b18368c6482946e4f2154ad04564fc00498bcd79c5",
      },
      {
        file: "gui_common_tex_iconitem_monster_6f25b88648faa65d68347c2f20f09b8c",
        sha256: "6ededabbed885e414db5172ab42ca303b307b241c9c7a8e88b7564190c34c529",
      },
      {
        file: "gui_common_tex_iconitem_currencyicon_bdd2603a4237b25b8f4ae05fde794429",
        sha256: "a85e4d5cf63bcbd9ce50e5e453578012e02d548af3e623f70f70d9fe3d3cb889",
      },
    ]);
  });

  it("records hashes and dimensions for every campaign screen asset", async () => {
    const manifest = await readCampaignUiManifest();
    expect(manifest.files).toHaveLength(22);
    expect(manifest.files.filter((entry) => (
      entry.sourceObject === "Main_background_01"
      || entry.sourceObject === "lihui_monster_01_jiachong"
      || entry.sourceObject === "lihui_monster_01_xiyi"
      || entry.sourceObject === "lihui_monster_01_zongquan"
    )).map((entry) => ({
      name: entry.sourceObject,
      width: entry.width,
      height: entry.height,
    }))).toEqual([
      { name: "Main_background_01", width: 720, height: 1600 },
      { name: "lihui_monster_01_jiachong", width: 134, height: 101 },
      { name: "lihui_monster_01_xiyi", width: 116, height: 123 },
      { name: "lihui_monster_01_zongquan", width: 129, height: 116 },
    ]);

    for (const entry of manifest.files) {
      const contents = await readFile(resolve(assetRoot, entry.file.path));
      expect(contents.byteLength, entry.file.path).toBe(entry.file.bytes);
      expect(await fileHash(entry.file.path), entry.file.path)
        .toBe(entry.file.sha256);
    }
  });
});
