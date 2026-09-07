import { openSync, readSync, closeSync, statSync } from "node:fs";

function boundedRead(path, limit) {
  const fd = openSync(path, "r");
  const bytes = Buffer.alloc(limit + 1);
  let length = 0;
  try {
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
  } finally {
    closeSync(fd);
  }
  if (length > limit) throw new Error("Oversized proc record");
  return new TextDecoder("utf-8", { fatal: true }).decode(
    bytes.subarray(0, length),
  );
}

export function parseStat(text, pid) {
  if (!text.startsWith(`${pid} (`)) return null;
  const end = text.lastIndexOf(")");
  if (end < 0 || text[end + 1] !== " ") return null;
  const fields = text
    .slice(end + 2)
    .trim()
    .split(/\s+/);
  if (
    !/^[RSDZTtXxKWPI]$/.test(fields[0] ?? "") ||
    !/^(0|[1-9][0-9]{0,19})$/.test(fields[19] ?? "") ||
    BigInt(fields[19]) > 18446744073709551615n
  )
    return null;
  return { state: fields[0], startTime: fields[19] };
}

export function readLinux(pid) {
  let raw;
  try {
    raw = boundedRead(`/proc/${pid}/stat`, 8192);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ESRCH") {
      try {
        if (
          parseStat(boundedRead(`/proc/${process.pid}/stat`, 8192), process.pid)
        ) {
          return {
            ok: false,
            error: {
              code: "NOT_FOUND",
              message: "The process no longer exists",
            },
          };
        }
      } catch {}
    }
    return {
      ok: false,
      error: {
        code:
          error.code === "EACCES" || error.code === "EPERM"
            ? "ACCESS_DENIED"
            : "INSPECTION_FAILED",
        message: "Process identity could not be read",
      },
    };
  }
  const parsed = parseStat(raw, pid);
  if (!parsed)
    return {
      ok: false,
      error: { code: "INSPECTION_FAILED", message: "Invalid proc record" },
    };
  if (["Z", "X", "x"].includes(parsed.state))
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "The process has exited" },
    };
  try {
    const bootId = boundedRead("/proc/sys/kernel/random/boot_id", 64)
      .trim()
      .toLowerCase();
    const namespace = statSync("/proc/self/ns/pid", { bigint: true });
    return {
      ok: true,
      value: {
        version: 1,
        platform: "linux",
        pid,
        bootId: `${bootId}:${namespace.dev}:${namespace.ino}`,
        startTime: parsed.startTime,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code:
          error.code === "EACCES" || error.code === "EPERM"
            ? "ACCESS_DENIED"
            : "INSPECTION_FAILED",
        message: "Process scope could not be read",
      },
    };
  }
}
