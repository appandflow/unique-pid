import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, copyFileSync } from "node:fs";
if (process.platform !== "linux") {
  const gyp = createRequire(import.meta.url).resolve(
    "node-gyp/bin/node-gyp.js",
  );
  const result = spawnSync(process.execPath, [gyp, "rebuild"], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else {
    const directory = `prebuilds/${process.platform}-${process.arch}`;
    mkdirSync(directory, { recursive: true });
    copyFileSync("build/Release/identity.node", `${directory}/node.napi.node`);
  }
}
