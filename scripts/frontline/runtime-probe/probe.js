const log = (...values) => {
  document.querySelector('#log').textContent += values.join(' ') + '\n';
};
window.addEventListener('error', event => log('ERROR', event.error?.stack || event.message));
window.addEventListener('unhandledrejection', event => log('REJECTED', event.reason?.stack || event.reason));
const factories = new Map();
const loaded = new Map();
window.define = (name, factory) => factories.set(name, factory);
function requireModule(name) {
  const key = name.endsWith('.js') ? name : `${name}.js`;
  if (loaded.has(key)) return loaded.get(key).exports;
  const module = { exports: {} };
  loaded.set(key, module);
  factories.get(key)(requireModule, module, module.exports);
  return module.exports;
}

async function start() {
  const primary = await WebAssembly.compileStreaming(fetch('/primary.wasm'));
  const secondary = await WebAssembly.compileStreaming(fetch('/secondary.wasm'));
  log('COMPILED primary / secondary', WebAssembly.Module.exports(primary).length, '/', WebAssembly.Module.exports(secondary).length, 'exports');
  const NativeAudioContext = window.AudioContext;
  // These are real browser implementations for device identification, audio and logs.
  // Unimplemented platform APIs are intentionally absent: failures remain visible.
  window.wx = {
    getDeviceInfo: () => ({ platform: 'browser' }),
    createWebAudioContext: () => new NativeAudioContext(),
  };
  window.GameGlobal = {
    unityNamespace: { canvas: document.querySelector('#canvas') },
    manager: {
      Logger: { eventLog: log },
      TimeLogger: { timeStart: label => { performance.mark(label); log('START', label); } },
    },
  };
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/framework.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  const framework = requireModule('webgl.wasm.framework.unityweb.js');
  log('FRAMEWORK factory loaded');
  await framework({
    canvas: document.querySelector('#canvas'),
    noInitialRun: true,
    preRun: [],
    print: log,
    printErr: log,
    instantiateWasm(imports, receiveInstance) {
      imports.primary = { table: new WebAssembly.Table({ initial: 144093, maximum: 144093, element: 'anyfunc' }) };
      for (const name of ['global$0', 'global$1', 'global$2']) {
        imports.primary[name] = new WebAssembly.Global({ value: 'i32', mutable: true });
      }
      const waitTableId = new WebAssembly.Global({ value: 'i32', mutable: true });
      imports.wasm_split = {
        __wasm_split_waitTableId: waitTableId,
        wait() { throw new Error(`Original split function unavailable: ${waitTableId.value}`); },
      };
      const instance = new WebAssembly.Instance(primary, imports);
      log('LINKED primary');
      imports.primary.memory = instance.exports.memory;
      for (const [name, value] of Object.entries(instance.exports)) {
        if (name.startsWith('wasm_split.')) imports.primary[name] = value;
      }
      imports.primary['wasm_split.initGlobal'] = instance.exports.initGlobal;
      instance.exports.initGlobal();
      new WebAssembly.Instance(secondary, imports);
      log('LINKED secondary; memory bytes', instance.exports.memory.buffer.byteLength);
      receiveInstance(instance, primary);
      log('Original modules connected. Asset preload and engine startup remain unverified.');
      return instance.exports;
    },
  });
  log('RUNTIME initialized; main was not invoked. No combat claim.');
}
start().catch(error => log('STOP', error.stack || error));
