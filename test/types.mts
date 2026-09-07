import { capture, check, decode } from "../index.mjs";

const result = capture(process.pid);
if (result.status === "captured") {
  const token: string = result.token;
  const pid: number = decode(token).pid;
  const status: "same" | "different" | "gone" | "unknown" = check(token).status;
  void pid;
  void status;
}
