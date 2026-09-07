import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const required = ["darwin-arm64", "darwin-x64", "win32-arm64", "win32-x64"].map(
  (target) => `prebuilds/${target}/node.napi.node`,
);
for (const file of required) assert.ok(existsSync(file), `Missing ${file}`);
const packed = spawnSync(
  process.execPath,
  [process.env.npm_execpath, "pack", "--json", "--ignore-scripts"],
  {
    encoding: "utf8",
    timeout: 60000,
  },
);
assert.equal(packed.status, 0, packed.stderr);
const [archive] = JSON.parse(packed.stdout);
const files = new Set(archive.files.map(({ path }) => path));
for (const file of required)
  assert.ok(files.has(file), `Tarball missing ${file}`);
console.log(archive.filename);
