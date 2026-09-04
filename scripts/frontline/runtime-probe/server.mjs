import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Local diagnostic only. Original game files remain outside the app/public bundle.
const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/frontline/runtime-probe/server.mjs /path/to/unpacked-wxapp');
const bundle = await readFile(`${root}/__WITHOUT_MULTI_PLUGINCODE__/game.js`, 'utf8');
const modules = [...bundle.matchAll(/define\("([^"]+)", function\(require, module, exports\)/g)];
const selected = modules.flatMap((match, index) => {
  if (!match[1].startsWith('@swc/runtime/') && match[1] !== 'webgl.wasm.framework.unityweb.js') return [];
  const block = bundle.slice(match.index, modules[index + 1].index);
  // Keep the registered factory; exclude the package's global plugin loader.
  return block.slice(0, block.lastIndexOf('});') + 3);
}).join('\n');
const routes = new Map([
  ['/primary.wasm', `${root}/_wasmcode_/wasmcode/2ef94219ebac60f3.webgl.wasm.code.unityweb.wasm`],
  ['/secondary.wasm', `${root}/_wasmcode1_/wasmcode1/2ef94219ebac60f3.webgl.wasm.code.unityweb.wasm`],
  ['/probe.js', fileURLToPath(new URL('./probe.js', import.meta.url))],
]);
const html = '<!doctype html><meta charset="utf-8"><title>前线原版运行时探针</title><h1>前线原版运行时探针</h1><p>本地离线验证；未加载游戏入口、账号 SDK 或线上资源。</p><pre id="log"></pre><canvas id="canvas" width="540" height="960"></canvas><script src="/probe.js"></script>';
createServer(async (req, res) => {
  try {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; img-src 'self' data:");
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    } else if (req.url === '/framework.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(selected);
    } else if (routes.has(req.url)) {
      res.setHeader('Content-Type', req.url.endsWith('.wasm') ? 'application/wasm' : 'application/javascript');
      res.end(await readFile(routes.get(req.url)));
    } else {
      res.writeHead(404).end();
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500).end(String(error));
  }
}).listen(4179, '127.0.0.1', () => console.log('http://127.0.0.1:4179'));
