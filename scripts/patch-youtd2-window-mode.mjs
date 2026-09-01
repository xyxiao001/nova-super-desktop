import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const PACK_PATH = new URL("../public/games/youtd2/index.pck", import.meta.url);
const PACK_HEADER_SIZE = 96;
const PROJECT_PATH = "res://project.binary";
const WINDOW_MODE_SETTING = "display/window/size/mode";
const WINDOWED = 0;
const FULLSCREEN = 3;

const align4 = (value) => (value + 3) & ~3;

function findPackedFile(pack, targetPath) {
  if (pack.subarray(0, 4).toString() !== "GDPC") {
    throw new Error("Invalid Godot PCK header");
  }
  const fileBase = Number(pack.readBigUInt64LE(24));
  const fileCount = pack.readUInt32LE(PACK_HEADER_SIZE);
  let cursor = PACK_HEADER_SIZE + 4;

  for (let index = 0; index < fileCount; index += 1) {
    const pathLength = pack.readUInt32LE(cursor);
    cursor += 4;
    const path = pack.subarray(cursor, cursor + pathLength).toString().replace(/\0+$/, "");
    cursor += align4(pathLength);
    const offset = Number(pack.readBigUInt64LE(cursor));
    cursor += 8;
    const size = Number(pack.readBigUInt64LE(cursor));
    cursor += 8;
    const hashOffset = cursor;
    cursor += 16;
    cursor += 4;

    if (path === targetPath) {
      return {
        offset: fileBase + offset,
        size,
        hashOffset,
      };
    }
  }
  throw new Error(`Missing packed file: ${targetPath}`);
}

function findIntegerSetting(project, targetSetting) {
  if (project.subarray(0, 4).toString() !== "ECFG") {
    throw new Error("Invalid Godot project settings header");
  }
  const settingCount = project.readUInt32LE(4);
  let cursor = 8;

  for (let index = 0; index < settingCount; index += 1) {
    const nameLength = project.readUInt32LE(cursor);
    cursor += 4;
    const name = project.subarray(cursor, cursor + nameLength).toString().replace(/\0+$/, "");
    cursor += nameLength;
    const valueLength = project.readUInt32LE(cursor);
    cursor += 4;
    const valueOffset = cursor;
    cursor += valueLength;

    if (name === targetSetting) {
      const variantType = project.readUInt32LE(valueOffset);
      if (valueLength !== 8 || variantType !== 2) {
        throw new Error(`Unexpected value encoding for ${targetSetting}`);
      }
      return valueOffset + 4;
    }
  }
  throw new Error(`Missing project setting: ${targetSetting}`);
}

const checkOnly = process.argv.includes("--check");
const pack = await readFile(PACK_PATH);
const projectEntry = findPackedFile(pack, PROJECT_PATH);
const project = pack.subarray(
  projectEntry.offset,
  projectEntry.offset + projectEntry.size,
);
const modeOffset = findIntegerSetting(project, WINDOW_MODE_SETTING);
const mode = project.readInt32LE(modeOffset);

if (checkOnly) {
  if (mode !== WINDOWED) {
    throw new Error(`Expected WINDOWED (${WINDOWED}), received ${mode}`);
  }
  const storedHash = pack.subarray(projectEntry.hashOffset, projectEntry.hashOffset + 16);
  const actualHash = createHash("md5").update(project).digest();
  if (!storedHash.equals(actualHash)) {
    throw new Error("project.binary checksum does not match the PCK directory");
  }
  console.log("YouTD 2 window mode is WINDOWED");
} else {
  if (mode !== FULLSCREEN && mode !== WINDOWED) {
    throw new Error(`Refusing to replace unexpected window mode ${mode}`);
  }
  project.writeInt32LE(WINDOWED, modeOffset);
  createHash("md5")
    .update(project)
    .digest()
    .copy(pack, projectEntry.hashOffset);
  await writeFile(PACK_PATH, pack);
  console.log(mode === WINDOWED
    ? "YouTD 2 window mode was already WINDOWED"
    : "Changed YouTD 2 window mode from FULLSCREEN to WINDOWED");
}
