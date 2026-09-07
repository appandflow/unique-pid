export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "INVALID_TOKEN"
  | "NOT_FOUND"
  | "ACCESS_DENIED"
  | "UNSUPPORTED_PLATFORM"
  | "NATIVE_UNAVAILABLE"
  | "INSPECTION_FAILED";
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ErrorCode; message: string } };
export interface ProcessIdentity {
  readonly version: 1;
  readonly platform: "darwin" | "linux" | "win32";
  readonly pid: number;
  readonly bootId: string | null;
  readonly startTime: string;
}
export declare function capture(pid: number): Result<string>;
export declare function check(
  token: string,
): Result<"same" | "different" | "gone">;
export declare function decode(token: string): Result<ProcessIdentity>;
