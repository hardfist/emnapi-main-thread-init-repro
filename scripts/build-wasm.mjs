import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: "inherit",
      shell: false,
      env: { ...process.env, ...(options.env ?? {}) },
    });

    child.on("exit", (code, signal) => {
      resolve({
        code,
        signal,
      });
    });
  });
}

function getEmnapiLinkDir() {
  const emnapiPackageJson = require.resolve("emnapi/package.json");
  return path.join(path.dirname(emnapiPackageJson), "lib", "wasm32-wasi-threads");
}

async function main() {
  const emnapiLinkDir = getEmnapiLinkDir();
  const buildEnv = {
    EMNAPI_LINK_DIR: emnapiLinkDir,
  };

  console.log(JSON.stringify({ emnapiLinkDir }));

  let result = await run("rustup", ["target", "add", "wasm32-wasip1-threads"]);
  if (result.code !== 0) {
    process.exit(result.code ?? 1);
  }

  result = await run(
    "cargo",
    ["build", "--target", "wasm32-wasip1-threads", "--release"],
    { env: buildEnv },
  );
  if (result.code !== 0) {
    process.exit(result.code ?? 1);
  }
}

await main();
