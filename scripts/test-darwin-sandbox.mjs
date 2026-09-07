import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { capture, check, decode } from "../index.mjs";

if (process.platform !== "darwin") process.exit(0);

const captured = capture(process.pid);
assert.equal(captured.ok, true, JSON.stringify(captured));
assert.notEqual(decode(captured.value).value.bootId, null);
const bootDenied = `(version 1) (allow default)
  (deny sysctl-read (sysctl-name "kern.bootsessionuuid"))
  (deny process-exec (literal "/bin/ps"))`;
const fixture = fileURLToPath(
  new URL("../test/darwin-sandbox.fixture.mjs", import.meta.url),
);

function run(profile, args, env = process.env) {
  const result = spawnSync(
    "/usr/bin/sandbox-exec",
    ["-p", profile, process.execPath, ...args],
    { encoding: "utf8", env, timeout: 30000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  return result.stdout;
}

const token = JSON.parse(
  run(bootDenied, [fixture, "boot-denied", captured.value]),
);
assert.equal(decode(token).value.bootId, null);
assert.deepEqual(check(token), { ok: true, value: "same" });
run("(version 1) (allow default) (deny process-info-pidinfo)", [
  fixture,
  "process-denied",
  captured.value,
]);
run(
  bootDenied,
  [
    "--test",
    fileURLToPath(new URL("../test/identity.test.mjs", import.meta.url)),
  ],
  { ...process.env, EXPECT_PS_DENIED: "1", EXPECT_BOOT_DENIED: "1" },
);
console.log("macOS sandbox identity and permission checks passed");
