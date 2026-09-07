const prefix = "upid1.";
const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const decimal = /^(0|[1-9][0-9]{0,19})$/;
const integer = (value) =>
  typeof value === "string" &&
  decimal.test(value) &&
  BigInt(value) <= 18446744073709551615n;

function valid(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "bootId,pid,platform,startTime,version" ||
    value.version !== 1 ||
    !Number.isInteger(value.pid) ||
    value.pid < 1 ||
    value.pid > 2147483647
  )
    return false;
  if (value.platform === "win32")
    return value.bootId === null && integer(value.startTime);
  if (typeof value.startTime !== "string") return false;
  if (value.platform === "linux")
    return (
      typeof value.bootId === "string" &&
      new RegExp(`^${uuid}:[0-9]{1,20}:[0-9]{1,20}$`).test(value.bootId) &&
      integer(value.startTime)
    );
  if (
    value.platform !== "darwin" ||
    (value.bootId !== null &&
      (typeof value.bootId !== "string" ||
        !new RegExp(`^${uuid}$`).test(value.bootId)))
  )
    return false;
  const parts = value.startTime.split(":");
  return (
    parts.length === 2 &&
    integer(parts[0]) &&
    integer(parts[1]) &&
    BigInt(parts[1]) < 1000000n
  );
}

export function encodeIdentity(identity) {
  return prefix + Buffer.from(JSON.stringify(identity)).toString("base64url");
}

export function decodeIdentity(token) {
  const invalid = {
    ok: false,
    error: { code: "INVALID_TOKEN", message: "Invalid process identity token" },
  };
  try {
    if (
      typeof token !== "string" ||
      token.length > 1024 ||
      !token.startsWith(prefix)
    )
      return invalid;
    const encoded = token.slice(prefix.length);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return invalid;
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.toString("base64url") !== encoded) return invalid;
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    return valid(value) ? { ok: true, value } : invalid;
  } catch {
    return invalid;
  }
}
