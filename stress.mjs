import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const binding = require("./binding.cjs");

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[index + 1];
}

const moduleCount = Number(readArg("modules", "8192"));
const itemsPerModule = Number(readArg("items-per-module", "64"));
const uniqueValueCount = Number(readArg("unique-values", "8192"));
const repeat = Number(readArg("repeat", "1"));
const runs = Number(readArg("runs", "1"));

console.log(
  JSON.stringify({
    rayonThreads: binding.rayonNumThreads(),
    moduleCount,
    itemsPerModule,
    uniqueValueCount,
    repeat,
    runs,
  }),
);

for (let run = 1; run <= runs; run += 1) {
  const startedAt = Date.now();
  const checksum = binding.indexmapBuildStress(
    moduleCount,
    itemsPerModule,
    uniqueValueCount,
    repeat,
  );
  console.log(
    JSON.stringify({
      run,
      checksum,
      elapsedMs: Date.now() - startedAt,
    }),
  );
}
