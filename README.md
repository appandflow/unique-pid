# unique-pid

Persist a process identity. Later, check whether that PID still belongs to the
same process.

**Early macOS prototype. Not published to npm or ready for production cleanup.**

Operating systems reuse process IDs. A saved PID alone can refer to an unrelated
process after the original exits. `unique-pid` pairs it with its exact
kernel-reported start time and boot-session identity.

```js
import { capture, check } from "./index.mjs";

const captured = capture(child.pid);
if (captured.status === "captured") {
  // Persist captured.token in trusted application state.
  const result = check(captured.token);
  console.log(result.status); // same | different | gone | unknown
}
```

Both operations use the same native reader. There is no approximate timestamp,
`Date.now()`, shell command, `ps`, or running-process listing.

## API

### `capture(pid)`

Returns `{ status: 'captured', token }`, `{ status: 'gone', errno }`, or
`{ status: 'unknown', errno }`. Invalid PIDs throw.

### `check(token)`

Returns one of:

| Status      | Meaning                                                                |
| ----------- | ---------------------------------------------------------------------- |
| `same`      | The observed PID, kernel start time, and boot session match.           |
| `different` | The PID exists, but the recorded identity does not match.              |
| `gone`      | The OS explicitly reports that the process does not exist.             |
| `unknown`   | Permission denial or another inspection failure prevents verification. |

Malformed tokens throw before querying the OS. Never treat `unknown` as `gone`.
`same` is a point-in-time identity observation, not an app-readiness check or
proof that the process is not a zombie.

### `decode(token)`

Returns the validated token fields for diagnostics. Tokens contain a format
version, platform, boot UUID, PID, and exact start seconds/microseconds stored as
decimal strings. Base64url is encoding, not encryption or authentication.

## Implementation

A small C addon uses the stable Node-API 8 ABI. The JavaScript layer owns token
encoding and validation, with TypeScript declarations. macOS uses
`proc_pidinfo(PROC_PIDTBSDINFO)` and `sysctlbyname("kern.bootsessionuuid")`.
It does not embed Python or compile a helper executable at runtime.

The initial prototype's same compiled addon was tested on Node 22, 24, and 26.
It worked under a sandbox that denied `/bin/ps`; a stricter sandbox denied native
inspection and correctly produced `unknown`. This is not a sandbox bypass or a
guarantee that every environment permits inspection.

## Safety boundaries

- Identity is not ownership. Only manage processes your application owns, and
  keep tokens in trusted state. A forged token is not an authorization grant.
- Capture promptly after spawn and account for early exit. An arbitrary-PID
  query cannot establish that the caller launched that process. A cooperating
  child can send its self-captured token through IPC.
- Rechecking then signaling is not atomic on macOS. This prototype deliberately
  exposes no `kill` or `terminate` API. Calling `process.kill()` after `check()`
  still has a time-of-check/time-of-use race.
- Identifying a group leader does not establish ownership of all descendants.
- Tokens are local to the originating host/boot context. They are not portable
  process references across machines or PID namespaces.
- Changes to command titles or an exec transition do not necessarily change
  process identity; executable role and readiness need separate checks.

The idea follows psutil's PID-plus-creation-time identity model, not a full port
of its monitoring API. See [psutil's PID reuse documentation](https://psutil.io/faq/#pid-reuse).

## Development

Requires macOS, Node 22+, Python, and Xcode Command Line Tools for the development
build. End-user prebuilt distribution is planned, not implemented yet. The
package remains private in package.json to prevent accidental npm publication.

```sh
npm ci --ignore-scripts
npm run build
npm run format:check
npm run typecheck
npm test
```

Tests inspect only short-lived children they create and stop them through IPC.
They cover exact repeated reads, parent/child agreement, fresh-process token
verification, timestamp and boot mismatches, malformed tokens, invalid PIDs,
title changes, and actual process exit. Mismatches are simulated against a live
owned child; tests do not force PID recycling or change the system clock.

## Next steps

- Linux and Windows backends with exact native identity fields.
- Prebuilt binaries, package installation tests, and platform/architecture CI.
- Additional denial, restart, reboot, clock-change, and short-lived-child tests.
- A lifecycle API only after its ownership and race semantics are defined;
  use retained OS handles where supported instead of promising atomic safety
  from a serialized token alone.

## License

MIT
