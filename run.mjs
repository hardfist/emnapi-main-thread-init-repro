import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import { WASI } from "node:wasi";
import { Worker } from "node:worker_threads";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { WASIThreads } = require("@emnapi/wasi-threads");

const rootDir = path.parse(process.cwd()).root;
const wasi = new WASI({
  version: "preview1",
  env: process.env,
  preopens: {
    [rootDir]: rootDir,
  },
});

const wasiThreads = new WASIThreads({
  wasi,
  reuseWorker: true,
  waitThreadStart: false,
  onCreateWorker() {
    const worker = new Worker(new URL("./worker.mjs", import.meta.url), {
      env: process.env,
    });
    worker.unref();
    return worker;
  },
});

const wasmPath = path.join(
  here,
  "target",
  "wasm32-wasip1-threads",
  "release",
  "emnapi_main_thread_init_repro.wasm",
);
const memory = new WebAssembly.Memory({
  initial: 17,
  maximum: 17,
  shared: true,
});
const wasmBytes = fs.readFileSync(wasmPath);
const { instance: originalInstance, module } = await WebAssembly.instantiate(wasmBytes, {
  env: { memory },
  wasi_snapshot_preview1: wasi.wasiImport,
  ...wasiThreads.getImportObject(),
});
const instance = wasiThreads.initialize(originalInstance, module, memory);

const command = process.argv[2] ?? "delete-first";

console.log(JSON.stringify({ command }));

if (command === "delete-first") {
  const ret = instance.exports.repro_pthread_key_delete_first();
  console.log(JSON.stringify({ command, ret: Number(ret) }));
} else if (command === "init-then-delete-first") {
  instance.exports.repro_call_wasi_init_tp();
  const ret = instance.exports.repro_pthread_key_delete_first();
  console.log(JSON.stringify({ command, ret: Number(ret) }));
} else if (command === "init-only") {
  const ret = instance.exports.repro_call_wasi_init_tp();
  console.log(JSON.stringify({ command, ret: Number(ret) }));
} else {
  throw new Error(`Unknown command: ${command}`);
}
