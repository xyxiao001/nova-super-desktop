import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serializeServiceWorkerResourcePackages } from "../app/resourcePackageManifest.ts";

const outputPath = fileURLToPath(new URL("../public/resource-packages.generated.js", import.meta.url));
await writeFile(outputPath, serializeServiceWorkerResourcePackages(), "utf8");

console.log("Generated resource package configuration.");
