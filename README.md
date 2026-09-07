# unique-pid

Save a process ID and identify the same process later.

Operating systems recycle PIDs. A PID saved in a file can eventually belong to
an unrelated process. `unique-pid` combines the PID with its exact OS-reported
start identity in a serializable token, so you can tell them apart.

Capture the token when a process starts, store it in a file or database, and
check it later, even from another invocation of your CLI. Supports macOS,
Linux, and Windows. No `ps` required.

```js
import { capture, check } from "unique-pid";

const captured = capture(process.pid);
if (!captured.ok) {
  console.error(captured.error);
} else {
  const checked = check(captured.value);
  console.log(checked); // { ok: true, value: 'same' }
}
```

## API

All functions return `{ ok: true, value }` or
`{ ok: false, error: { code, message } }`. Invalid input, unavailable native
binaries, and permission failures are results, not thrown exceptions.

- `capture(pid)` returns a serializable identity token.
- `check(token)` returns `same`, `different`, or `gone`.
- `decode(token)` returns the token's validated fields for inspection.

An inspection error is not proof that a process is gone. Tokens use exact
OS start values, not approximate dates. Linux also includes boot and PID
namespace identity; macOS includes boot identity. Windows uses the process's
64-bit creation time.

Tokens belong in trusted state on the originating machine. They are not
credentials. Identity checks do not prove ownership or make a later PID-based
signal atomic. This package does not terminate processes.

## Development

Node 20.19.4+ (20.x) or 22.12+. Native development
builds require Python and Xcode Command Line Tools on macOS, or Visual Studio
C++ Build Tools on Windows. Linux reads procfs directly.

```sh
npm ci --ignore-scripts
npm run build
npm run typecheck
npm run format:check
npm test
```

MIT
