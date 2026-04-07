const fs = require("node:fs");
const path = require("node:path");
const { WASI } = require("node:wasi");
const { Worker } = require("node:worker_threads");

const {
  getDefaultContext,
  instantiateNapiModuleSync,
} = require("@napi-rs/wasm-runtime");

const rootDir = path.parse(process.cwd()).root;
const wasi = new WASI({
  version: "preview1",
  env: process.env,
  preopens: {
    [rootDir]: rootDir,
  },
});

const emnapiContext = getDefaultContext();
const sharedMemory = new WebAssembly.Memory({
  initial: 1024,
  maximum: 65536,
  shared: true,
});

const wasmPath = path.join(
  __dirname,
  "target",
  "wasm32-wasip1-threads",
  "release",
  "emnapi_main_thread_init_repro.wasm",
);

function unrefWorker(worker) {
  const kPublicPort = Object.getOwnPropertySymbols(worker).find((s) =>
    s.toString().includes("kPublicPort"),
  );
  if (kPublicPort) {
    worker[kPublicPort].ref = () => {};
  }

  const kHandle = Object.getOwnPropertySymbols(worker).find((s) =>
    s.toString().includes("kHandle"),
  );
  if (kHandle) {
    worker[kHandle].ref = () => {};
  }

  worker.unref();
}

const { napiModule } = instantiateNapiModuleSync(fs.readFileSync(wasmPath), {
  context: emnapiContext,
  asyncWorkPoolSize: 4,
  reuseWorker: true,
  wasi,
  onCreateWorker() {
    const worker = new Worker(path.join(__dirname, "wasi-worker.mjs"), {
      env: process.env,
    });
    unrefWorker(worker);
    return worker;
  },
  overwriteImports(importObject) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
      memory: sharedMemory,
    };
    return importObject;
  },
  beforeInit({ instance }) {
    for (const name of Object.keys(instance.exports)) {
      if (name.startsWith("__napi_register__")) {
        instance.exports[name]();
      }
    }
  },
});

module.exports = napiModule.exports;
