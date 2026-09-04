import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectSpineActor } from "./spine-metadata.mjs";

const outputRoot = resolve(
  process.argv[2] ?? "public/assets/games/frontline",
);
const manifestPath = resolve(
  process.argv[3] ?? `${outputRoot}/levels/desert-1/manifest.json`,
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const actors = [
  ...manifest.actors.heroes,
  manifest.actors.lord,
  ...manifest.actors.enemies,
  ...manifest.actors.summons,
];

for (const actor of actors) {
  await inspectSpineActor(actor, outputRoot);
}

await writeFile(
  manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(`Inspected ${actors.length} first-level Spine actor(s).`);
