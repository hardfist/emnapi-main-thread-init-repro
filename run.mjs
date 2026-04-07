import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const binding = require("./binding.cjs");

const command = process.argv[2] ?? "delete-first";

console.log(JSON.stringify({ command }));

if (command === "delete-first") {
  const ret = binding.deleteFirst();
  console.log(JSON.stringify({ command, ret: Number(ret) }));
} else if (command === "init-then-delete-first") {
  const ret = binding.initThenDeleteFirst();
  console.log(JSON.stringify({ command, ret: Number(ret) }));
} else if (command === "init-only") {
  const ret = binding.callWasiInitTp();
  console.log(JSON.stringify({ command, ret: Number(ret) }));
} else {
  throw new Error(`Unknown command: ${command}`);
}
