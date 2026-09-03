import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectSpineActor } from "./spine-metadata.mjs";

const outputRoot = resolve(
  process.argv[2] ?? "public/assets/games/frontline",
);
const manifestPath = resolve(outputRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

for (const actor of manifest.spineActors) {
  await inspectSpineActor(actor, outputRoot);
}

await writeFile(
  manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(`Inspected ${manifest.spineActors.length} Spine actor(s).`);
