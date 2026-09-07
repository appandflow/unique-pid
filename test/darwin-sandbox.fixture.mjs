import assert from "node:assert/strict";
import { capture, check, decode } from "../index.mjs";

const [mode, token] = process.argv.slice(2);
if (mode === "process-denied") {
  assert.equal(capture(process.pid).error.code, "ACCESS_DENIED");
  assert.equal(check(token).error.code, "ACCESS_DENIED");
} else {
  assert.equal(mode, "boot-denied");
  const saved = decode(token).value;
  const captured = capture(saved.pid);
  assert.equal(captured.ok, true, JSON.stringify(captured));
  assert.equal(decode(captured.value).value.bootId, null);
  assert.deepEqual(check(captured.value), { ok: true, value: "same" });
  assert.equal(check(token).error.code, "ACCESS_DENIED");
  const different =
    "upid1." +
    Buffer.from(JSON.stringify({ ...saved, startTime: "0:0" })).toString(
      "base64url",
    );
  assert.deepEqual(check(different), { ok: true, value: "different" });
  console.log(JSON.stringify(captured.value));
}
