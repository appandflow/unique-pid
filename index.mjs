import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin")
  throw new Error("This prototype supports macOS only");
const native = createRequire(import.meta.url)("node-gyp-build")(
  fileURLToPath(new URL(".", import.meta.url)),
);
const prefix = "pi1.";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const decimal = /^(0|[1-9][0-9]{0,19})$/;

function validate(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "bootId,micros,pid,platform,seconds,v" ||
    value.v !== 1 ||
    value.platform !== "darwin" ||
    !Number.isInteger(value.pid) ||
    value.pid < 1 ||
    value.pid > 2147483647 ||
    typeof value.bootId !== "string" ||
    !uuid.test(value.bootId) ||
    typeof value.seconds !== "string" ||
    !decimal.test(value.seconds) ||
    BigInt(value.seconds) > 18446744073709551615n ||
    typeof value.micros !== "string" ||
    !decimal.test(value.micros) ||
    BigInt(value.micros) > 999999n
  ) {
    throw new TypeError("Invalid process identity");
  }
  return value;
}

export function decode(token) {
  if (
    typeof token !== "string" ||
    token.length > 1024 ||
    !token.startsWith(prefix)
  ) {
    throw new TypeError("Invalid process identity token");
  }
  const encoded = token.slice(prefix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded))
    throw new TypeError("Invalid token encoding");
  const bytes = Buffer.from(encoded, "base64url");
  if (bytes.toString("base64url") !== encoded)
    throw new TypeError("Noncanonical token encoding");
  const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return validate(JSON.parse(json));
}

export function capture(pid) {
  const found = native.read(pid);
  if (found.status !== "found") return found;
  const identity = validate({
    v: 1,
    platform: "darwin",
    bootId: found.bootId,
    pid: found.pid,
    seconds: found.seconds,
    micros: found.micros,
  });
  return {
    status: "captured",
    token: prefix + Buffer.from(JSON.stringify(identity)).toString("base64url"),
  };
}

export function check(token) {
  const expected = decode(token);
  const found = native.read(expected.pid);
  if (found.status !== "found") return found;
  return {
    status:
      found.bootId === expected.bootId &&
      found.seconds === expected.seconds &&
      found.micros === expected.micros
        ? "same"
        : "different",
  };
}
