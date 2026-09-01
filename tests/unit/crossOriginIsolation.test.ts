import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readWorkspaceFile = (path: string) => readFileSync(
  new URL(`../../${path}`, import.meta.url),
  "utf8",
);

describe("cross-origin isolation", () => {
  it("enables SharedArrayBuffer on Vercel", () => {
    const config = JSON.parse(readWorkspaceFile("vercel.json")) as {
      rewrites: Array<{ source: string; destination: string }>;
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };
    expect(config.rewrites).toEqual([
      {
        source: "/games/youtd2/index.pck",
        destination: "https://media.githubusercontent.com/media/xyxiao001/nova-super-desktop/main/public/games/youtd2/index.pck",
      },
      {
        source: "/games/youtd2/index.side.wasm",
        destination: "https://media.githubusercontent.com/media/xyxiao001/nova-super-desktop/main/public/games/youtd2/index.side.wasm",
      },
    ]);
    expect(config.headers).toEqual([
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ]);
    expect(JSON.parse(readWorkspaceFile("package.json")).scripts["build:vercel"])
      .toContain("node scripts/prepare-vercel-output.mjs");
    const outputPreparation = readWorkspaceFile("scripts/prepare-vercel-output.mjs");
    expect(outputPreparation).toContain("../dist-vercel/games/youtd2/index.pck");
    expect(outputPreparation).toContain("../dist-vercel/games/youtd2/index.side.wasm");
    expect(outputPreparation).toContain("await unlink(assetUrl)");
  });

  it("enables the same policy in Vite and Cloudflare", () => {
    const viteConfig = readWorkspaceFile("vite.config.ts");
    const worker = readWorkspaceFile("worker/index.ts");
    for (const source of [viteConfig, worker]) {
      expect(source).toContain('"Cross-Origin-Opener-Policy"');
      expect(source).toContain('"Cross-Origin-Embedder-Policy"');
      expect(source).toContain('"same-origin"');
      expect(source).toContain('"require-corp"');
    }
    expect(viteConfig).toContain('delete request.headers["if-none-match"]');
    expect(viteConfig).toContain('response.setHeader("Cache-Control", "no-store")');
  });

  it("delegates cross-origin isolation to the YouTD 2 frame", () => {
    expect(readWorkspaceFile("src/apps/youtd2/entry.tsx"))
      .toContain("cross-origin-isolated");
  });
});
