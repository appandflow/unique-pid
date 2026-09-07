export interface ProcessIdentity {
  v: 1;
  platform: "darwin";
  bootId: string;
  pid: number;
  seconds: string;
  micros: string;
}

export type Unavailable = { status: "gone" | "unknown"; errno: number };

export declare function capture(
  pid: number,
): { status: "captured"; token: string } | Unavailable;

export declare function check(
  token: string,
): { status: "same" | "different" } | Unavailable;

export declare function decode(token: string): ProcessIdentity;
