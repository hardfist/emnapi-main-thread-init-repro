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
  console.log("==> ensuring Rust target");
  let result = await run("rustup", ["target", "add", "wasm32-wasip1-threads"]);
  if (result.code !== 0) {
    process.exit(result.code ?? 1);
  }

  console.log("==> building wasm");
  result = await run("cargo", ["build", "--target", "wasm32-wasip1-threads", "--release"]);
  if (result.code !== 0) {
    process.exit(result.code ?? 1);
  }

  console.log("==> failing case: delete-first");
  result = await run("node", ["run.mjs", "delete-first"], { timeoutMs: 10_000 });
  if (!result.timedOut) {
    console.error("expected delete-first to hang and hit timeout");
    process.exit(1);
  }

  console.log("==> control case: init-then-delete-first");
  result = await run("node", ["run.mjs", "init-then-delete-first"], { timeoutMs: 10_000 });
  if (result.code !== 0 || result.timedOut) {
    console.error("expected init-then-delete-first to complete successfully");
    process.exit(result.code ?? 1);
  }

  console.log("==> reproduced");
}

await main();
