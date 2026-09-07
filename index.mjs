import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readLinux } from "./lib/linux.mjs";
import { decodeIdentity, encodeIdentity } from "./lib/token.mjs";

let native;
const failure = (code, message) => ({ ok: false, error: { code, message } });

function observe(pid) {
  if (process.platform === "linux") return readLinux(pid);
  if (process.platform !== "darwin" && process.platform !== "win32") {
    return failure(
      "UNSUPPORTED_PLATFORM",
      "This operating system is not supported",
    );
  }
  if (!native) {
    try {
      native = createRequire(import.meta.url)("node-gyp-build")(
        fileURLToPath(new URL(".", import.meta.url)),
      );
    } catch {
      return failure(
        "NATIVE_UNAVAILABLE",
        "The native addon could not be loaded",
      );
    }
  }
  const found = native.read(pid);
  if (found.status === "gone")
    return failure("NOT_FOUND", "The process no longer exists");
  if (found.status === "denied")
    return failure("ACCESS_DENIED", "Process inspection was denied");
  if (found.status !== "found")
    return failure("INSPECTION_FAILED", "Process identity could not be read");
  return {
    ok: true,
    value: {
      version: 1,
      platform: process.platform,
      pid,
      bootId: found.bootId,
      startTime: found.startTime,
    },
  };
}

export function capture(pid) {
  try {
    if (!Number.isInteger(pid) || pid < 1 || pid > 2147483647) {
      return failure(
        "INVALID_ARGUMENT",
        "PID must be a positive 32-bit integer",
      );
    }
    const observed = observe(pid);
    if (!observed.ok) return observed;
    const token = encodeIdentity(observed.value);
    if (!decodeIdentity(token).ok)
      return failure(
        "INSPECTION_FAILED",
        "The OS returned an invalid identity",
      );
    return { ok: true, value: token };
  } catch {
    return failure("INSPECTION_FAILED", "Process identity could not be read");
  }
}

export function check(token) {
  try {
    const decoded = decodeIdentity(token);
    if (!decoded.ok) return decoded;
    if (decoded.value.platform !== process.platform)
      return { ok: true, value: "different" };
    const current = capture(decoded.value.pid);
    if (!current.ok)
      return current.error.code === "NOT_FOUND"
        ? { ok: true, value: "gone" }
        : current;
    const observed = decodeIdentity(current.value);
    if (!observed.ok)
      return failure(
        "INSPECTION_FAILED",
        "The OS returned an invalid identity",
      );
    if (observed.value.startTime !== decoded.value.startTime)
      return { ok: true, value: "different" };
    if (decoded.value.bootId !== null) {
      if (observed.value.bootId === null)
        return failure(
          "ACCESS_DENIED",
          "The saved boot identity could not be verified",
        );
      if (observed.value.bootId !== decoded.value.bootId)
        return { ok: true, value: "different" };
    }
    return { ok: true, value: "same" };
  } catch {
    return failure(
      "INSPECTION_FAILED",
      "Process identity could not be checked",
    );
  }
}

export function decode(token) {
  return decodeIdentity(token);
}
