import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "unique-pid-package-"));
function npm(args, cwd) {
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, ...args],
    {
      cwd,
      encoding: "utf8",
      timeout: 60000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
try {
  const packed = JSON.parse(
    npm(
      ["pack", "--json", "--ignore-scripts", "--pack-destination", root],
      process.cwd(),
    ),
  );
  npm(
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      join(root, packed[0].filename),
    ],
    root,
  );
  const code =
    "import {capture,check} from 'unique-pid'; const r=capture(process.pid); if(!r.ok) throw Error(JSON.stringify(r)); const c=check(r.value); if(!c.ok || c.value!=='same') throw Error(JSON.stringify(c)); console.log('Installed package verified without build scripts');";
  const checked = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", code],
    { cwd: root, encoding: "utf8", timeout: 10000 },
  );
  assert.equal(checked.status, 0, checked.stderr);
  process.stdout.write(checked.stdout);
} finally {
  rmSync(root, { recursive: true, force: true });
}
