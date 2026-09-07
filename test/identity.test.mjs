import assert from "node:assert/strict";
import test from "node:test";
import { fork, spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { capture, check, decode } from "../index.mjs";

const encode = (value) =>
  "upid1." + Buffer.from(JSON.stringify(value)).toString("base64url");

test("exact identity survives serialization, fresh readers, and title changes", async () => {
  const child = fork(fileURLToPath(new URL("./child.mjs", import.meta.url)), {
    execArgv: [],
    env: { ...process.env, PATH: "", Path: "" },
  });
  const exited = once(child, "exit");
  let token;
  try {
    const [self] = await once(child, "message");
    const captured = capture(child.pid);
    assert.equal(captured.ok, true, JSON.stringify(captured));
    assert.deepEqual(captured, self);
    token = captured.value;
    for (let i = 0; i < 100; i++)
      assert.deepEqual(capture(child.pid), captured);
    const code = `import {check} from ${JSON.stringify(new URL("../index.mjs", import.meta.url).href)}; console.log(JSON.stringify(check(process.argv[1])));`;
    const other = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", code, token],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: "", Path: "" },
        timeout: 5000,
      },
    );
    assert.equal(other.status, 0, other.stderr);
    assert.deepEqual(JSON.parse(other.stdout), { ok: true, value: "same" });
    const identity = decode(token).value;
    const parts = identity.startTime.split(":");
    if (parts.length === 2)
      parts[1] = String((BigInt(parts[1]) + 1n) % 1000000n);
    else parts[0] = String(BigInt(parts[0]) + 1n);
    assert.deepEqual(
      check(encode({ ...identity, startTime: parts.join(":") })),
      { ok: true, value: "different" },
    );
    if (identity.bootId !== null) {
      const bootId = identity.bootId.replace(/^[a-f0-9]/, (x) =>
        x === "0" ? "1" : "0",
      );
      assert.deepEqual(check(encode({ ...identity, bootId })), {
        ok: true,
        value: "different",
      });
    }
    child.send("rename");
    await once(child, "message");
    assert.deepEqual(check(token), { ok: true, value: "same" });
    if (process.env.EXPECT_PS_DENIED === "1") {
      const ps = spawnSync("/bin/ps", ["-p", String(child.pid), "-o", "pid="], {
        timeout: 2000,
      });
      assert.equal(ps.error?.code, "EPERM");
    }
  } finally {
    if (child.connected) child.send("stop");
    const [code, signal] = await exited;
    assert.equal(code, 0);
    assert.equal(signal, null);
  }
  assert.deepEqual(check(token), { ok: true, value: "gone" });
  assert.equal(capture(child.pid).error.code, "NOT_FOUND");
});

test("invalid inputs are results, including hostile objects", () => {
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new Error("do not coerce");
      },
    },
  );
  for (const pid of [
    undefined,
    null,
    "1",
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    2147483648,
    1n,
    Symbol(),
    hostile,
  ]) {
    assert.deepEqual(capture(pid), {
      ok: false,
      error: {
        code: "INVALID_ARGUMENT",
        message: "PID must be a positive 32-bit integer",
      },
    });
  }
  for (const token of [
    undefined,
    null,
    hostile,
    Symbol(),
    "",
    "upid1.!!!!",
    "upid1.a",
    "x".repeat(1025),
  ]) {
    assert.equal(check(token).error.code, "INVALID_TOKEN");
    assert.equal(decode(token).error.code, "INVALID_TOKEN");
  }
});

test("invalid token schemas, encodings, and precision loss are rejected", () => {
  const identity = {
    version: 1,
    platform: "darwin",
    pid: 123,
    bootId: "01234567-0123-0123-0123-0123456789ab",
    startTime: "123:456",
  };
  for (const patch of [
    { pid: 0 },
    { pid: -1 },
    { pid: 1.5 },
    { version: 2 },
    { platform: "unknown" },
    { startTime: "01:2" },
    { startTime: "123:1000000" },
    { startTime: "18446744073709551616:0" },
    { startTime: 123 },
    { surprise: true },
  ]) {
    assert.equal(
      decode(encode({ ...identity, ...patch })).error.code,
      "INVALID_TOKEN",
    );
  }
  assert.equal(decode(encode(identity) + "=").error.code, "INVALID_TOKEN");
  assert.equal(
    decode("upid1." + Buffer.from([0xff]).toString("base64url")).error.code,
    "INVALID_TOKEN",
  );
  const windows = {
    ...identity,
    platform: "win32",
    bootId: null,
    startTime: "18446744073709551615",
  };
  assert.deepEqual(decode(encode(windows)), { ok: true, value: windows });
  if (process.platform !== "win32")
    assert.deepEqual(check(encode(windows)), { ok: true, value: "different" });
});
