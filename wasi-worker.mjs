import fs from "node:fs";
import { createRequire } from "node:module";
import { parse } from "node:path";
import { WASI } from "node:wasi";
import { Worker, parentPort } from "node:worker_threads";

const require = createRequire(import.meta.url);
const {
  MessageHandler,
  getDefaultContext,
  instantiateNapiModuleSync,
} = require("@napi-rs/wasm-runtime");

if (parentPort) {
  parentPort.on("message", (data) => {
    globalThis.onmessage({ data });
  });
}

Object.assign(globalThis, {
  self: globalThis,
  require,
  Worker,
  importScripts(file) {
    (0, eval)(fs.readFileSync(file, "utf8") + `\n//# sourceURL=${file}`);
  },
  postMessage(message) {
    parentPort?.postMessage(message);
  },
});

const emnapiContext = getDefaultContext();
const rootDir = parse(process.cwd()).root;

const handler = new MessageHandler({
  onLoad({ wasmModule, wasmMemory }) {
    const wasi = new WASI({
      version: "preview1",
      env: process.env,
      preopens: {
        [rootDir]: rootDir,
      },
    });

    return instantiateNapiModuleSync(wasmModule, {
      childThread: true,
      context: emnapiContext,
      wasi,
      overwriteImports(importObject) {
        importObject.env = {
          ...importObject.env,
          ...importObject.napi,
          ...importObject.emnapi,
          memory: wasmMemory,
        };
      },
    });
  },
});

globalThis.onmessage = function onmessage(event) {
  handler.handle(event);
};
