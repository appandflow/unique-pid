import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

test(
  "missing addon does not prevent import or throw from public calls",
  { skip: process.platform === "linux" },
  () => {
    const dir = mkdtempSync(join(tmpdir(), "unique-pid-loading-"));
    try {
      cpSync(new URL("../index.mjs", import.meta.url), join(dir, "index.mjs"));
      cpSync(new URL("../lib", import.meta.url), join(dir, "lib"), {
        recursive: true,
      });
      const code = `import {capture,decode} from ${JSON.stringify(pathToFileURL(join(dir, "index.mjs")).href)}; console.log(JSON.stringify([capture(process.pid),decode(null)]));`;
      const run = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", code],
        { encoding: "utf8", timeout: 5000 },
      );
      assert.equal(run.status, 0, run.stderr);
      assert.deepEqual(
        JSON.parse(run.stdout).map((result) => result.error.code),
        ["NATIVE_UNAVAILABLE", "INVALID_TOKEN"],
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
