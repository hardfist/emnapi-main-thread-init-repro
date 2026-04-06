import { createRequire } from "node:module";
import { WASI } from "node:wasi";
import { parentPort } from "node:worker_threads";

const require = createRequire(import.meta.url);
const { ThreadMessageHandler, WASIThreads } = require("@emnapi/wasi-threads");

if (parentPort) {
  parentPort.on("message", (data) => {
    globalThis.onmessage({ data });
  });
}

Object.assign(globalThis, {
  self: globalThis,
  require,
  postMessage(message) {
    parentPort?.postMessage(message);
  },
});

const rootDir = "/";
const handler = new ThreadMessageHandler({
  onLoad({ wasmModule, wasmMemory }) {
    const wasi = new WASI({
      version: "preview1",
      env: process.env,
      preopens: {
        [rootDir]: rootDir,
      },
    });
    const wasiThreads = new WASIThreads({
      wasi,
      childThread: true,
    });
    const originalInstance = new WebAssembly.Instance(wasmModule, {
      env: { memory: wasmMemory },
      wasi_snapshot_preview1: wasi.wasiImport,
      ...wasiThreads.getImportObject(),
    });
    const instance = wasiThreads.initialize(originalInstance, wasmModule, wasmMemory);
    return { module: wasmModule, instance };
  },
});

globalThis.onmessage = function onmessage(event) {
  handler.handle(event);
};
