import { spawn } from "node:child_process";
import process from "node:process";

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: "inherit",
      shell: false,
      env: { ...process.env, ...(options.env ?? {}) },
    });

    let timedOut = false;
    let timer = null;
    if (options.timeoutMs) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, options.timeoutMs);
    }

    child.on("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({
        code,
        signal,
        timedOut,
      });
    });
  });
}

async function main() {
  console.log("==> building napi-rs wasm");
  let result = await run("node", ["scripts/build-wasm.mjs"]);
  if (result.code !== 0) {
    process.exit(result.code ?? 1);
  }

  const stressArgs = [
    "stress.mjs",
    "--modules",
    "4096",
    "--items-per-module",
    "32",
    "--unique-values",
    "4096",
    "--repeat",
    "1",
    "--runs",
    "1",
  ];

  console.log("==> control case: single-threaded");
  result = await run("node", stressArgs, {
    timeoutMs: 15_000,
    env: {
      NODE_NO_WARNINGS: "1",
      RAYON_NUM_THREADS: "1",
    },
  });
  if (result.code !== 0 || result.timedOut) {
    console.error("expected single-threaded control case to complete successfully");
    process.exit(1);
  }

  console.log("==> flaky case: repeated multi-threaded attempts");
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    console.log(`==> attempt ${attempt}/10`);
    result = await run("node", stressArgs, {
      timeoutMs: 15_000,
      env: {
        NODE_NO_WARNINGS: "1",
        RAYON_NUM_THREADS: "32",
      },
    });

    if (result.code !== 0 || result.timedOut) {
      console.log("==> reproduced");
      return;
    }
  }

  console.error("did not observe the flaky failure within 10 attempts");
  process.exit(1);
}

await main();
