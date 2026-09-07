import assert from "node:assert/strict";
import { fork, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { capture, check, decode } from "../index.mjs";

const mode = process.argv[2];
if (mode === "child") {
  const expiry = setTimeout(() => process.exit(2), 15000);
  process.on("message", (message) => {
    if (message === "rename") {
      process.title = "identity-poc-renamed";
      process.send("renamed");
    }
    if (message === "stop") {
      clearTimeout(expiry);
      process.disconnect();
    }
  });
  process.send(capture(process.pid));
} else if (mode === "verify") {
  console.log(JSON.stringify(check(process.argv[3])));
} else {
  const file = fileURLToPath(import.meta.url);
  const child = fork(file, ["child"], { execArgv: [], env: { PATH: "" } });
  const exited = once(child, "exit");
  const [selfCaptured] = await once(child, "message");
  let token;
  try {
    const captured = capture(child.pid);
    assert.equal(captured.status, "captured");
    token = captured.token;
    assert.equal(
      token,
      selfCaptured.token,
      "parent and child read exactly the same kernel identity",
    );
    for (let i = 0; i < 100; i++) assert.equal(capture(child.pid).token, token);
    console.log("PASS: child/parent identity agrees, 100 exact repeat reads");
    const verified = spawnSync(process.execPath, [file, "verify", token], {
      env: { PATH: "" },
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(JSON.parse(verified.stdout).status, "same");
    console.log(
      "PASS: serialized token verified by a fresh Node process with empty PATH",
    );
    const modified = (patch) =>
      "pi1." +
      Buffer.from(JSON.stringify({ ...decode(token), ...patch })).toString(
        "base64url",
      );
    const identity = decode(token);
    assert.equal(
      check(
        modified({ micros: String((Number(identity.micros) + 1) % 1000000) }),
      ).status,
      "different",
    );
    assert.equal(
      check(modified({ bootId: "00000000-0000-0000-0000-000000000000" }))
        .status,
      "different",
    );
    console.log("PASS: one-microsecond and boot-session mismatches rejected");
    for (const bad of [
      null,
      "",
      "pi1.!!!!",
      "pi1.a",
      token + "=",
      "x".repeat(1025),
      modified({ pid: 0 }),
      modified({ pid: -1 }),
      modified({ pid: 1.5 }),
      modified({ v: 2 }),
      modified({ platform: "linux" }),
      modified({ seconds: "01" }),
      modified({ seconds: "18446744073709551616" }),
      modified({ micros: "1000000" }),
      modified({ surprise: true }),
    ])
      assert.throws(() => check(bad));
    const native = createRequire(import.meta.url)(
      "../build/Release/identity.node",
    );
    for (const pid of [undefined, "1", NaN, Infinity, 0, -1, 1.5, 2147483648]) {
      assert.throws(() => native.read(pid));
    }
    console.log("PASS: malformed tokens and invalid PIDs refused");
    child.send("rename");
    await once(child, "message");
    assert.equal(check(token).status, "same");
    console.log("PASS: command-title changes do not change identity");
    const ps = spawnSync("/bin/ps", ["-p", String(child.pid), "-o", "pid="], {
      timeout: 2000,
    });
    if (process.env.EXPECT_PS_DENIED === "1")
      assert.equal(ps.error?.code, "EPERM");
    console.log(
      JSON.stringify({
        psStatus: ps.status,
        psError: ps.error?.code,
        node: process.version,
      }),
    );
  } finally {
    if (child.connected) child.send("stop");
    const [code, signal] = await exited;
    assert.equal(code, 0);
    assert.equal(signal, null);
  }
  assert.equal(check(token).status, "gone");
  console.log("PASS: exited child reported gone; child stopped through IPC");
}
