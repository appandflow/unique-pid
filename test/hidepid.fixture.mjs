import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fork } from "node:child_process";
import { once } from "node:events";
import { capture, check } from "../index.mjs";

if (process.argv[2] === "probe") {
  const pid = Number(process.argv[3]);
  assert.throws(() => readFileSync(`/proc/${pid}/stat`), { code: "ENOENT" });
  const result = check(process.argv[4]);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "ACCESS_DENIED");
} else {
  const token = capture(process.pid);
  assert.equal(token.ok, true);
  const child = fork(
    new URL(import.meta.url),
    ["probe", String(process.pid), token.value],
    {
      uid: 65534,
      gid: 65534,
      stdio: "inherit",
    },
  );
  const [code] = await once(child, "exit");
  assert.equal(code, 0);
}
