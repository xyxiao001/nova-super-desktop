import { stat, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const proxiedAssets = [
  "../dist-vercel/games/youtd2/index.pck",
  "../dist-vercel/games/youtd2/index.side.wasm",
];

for (const asset of proxiedAssets) {
  const assetUrl = new URL(asset, import.meta.url);
  const details = await stat(assetUrl);
  if (!details.isFile()) {
    throw new Error(`Expected Vercel output asset: ${fileURLToPath(assetUrl)}`);
  }
  await unlink(assetUrl);
}

console.log(`Prepared ${proxiedAssets.length} proxied YouTD 2 assets for Vercel`);
