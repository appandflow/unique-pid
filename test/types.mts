import { capture, check, decode, type ErrorCode } from "../index.mjs";
const result = capture(process.pid);
if (result.ok) {
  const token: string = result.value;
  const identity = decode(token);
  if (identity.ok) {
    const pid: number = identity.value.pid;
    void pid;
  }
  const checked = check(token);
  if (checked.ok) {
    const status: "same" | "different" | "gone" = checked.value;
    void status;
  }
} else {
  const code: ErrorCode = result.error.code;
  void code;
}
