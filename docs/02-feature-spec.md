# Feature Specification: Direct IP Support + Docker Compatibility

## Goals

1. Allow controlling a device by **direct IP/host** (unicast) instead of relying on broadcast.
2. Keep **backwards compatibility** with the existing `subnet` broadcast-based configuration.
3. Improve the codebase to follow modern Node/Homebridge practices and remove deprecated usage.

Non-goals (for the first iteration):

- Device discovery / scanning.
- Automatic IP detection.
- Multi-service accessories (still one `Service.Switch` per accessory config).

## New configuration

### New key

Add one optional key:

- `host` (preferred name) or `ip` (alias)
  - type: string
  - example: `192.168.0.42`

### Resolution rules

- If `host` is provided, use it as UDP destination.
- Else if `ip` is provided, use it as UDP destination.
- Else use the existing `subnet` value (broadcast destination).

### Broadcast behavior

- When destination is broadcast (`255.255.255.255` or ends with `.255`): enable `client.setBroadcast(true)`.
- When destination is unicast: do not enable broadcast.

Rationale:

- Some environments behave oddly if broadcast is enabled when sending to unicast.
- Being explicit makes intent clearer and avoids surprises.

## Behavior changes

### Startup state query

- Must work over both broadcast and unicast.
- The result mapping must stay consistent:
  - for query (`cmd:25`), response `op.soft_poweroff == 0` should map to `On: true`.

### Power on/off

- Must work over both broadcast and unicast.
- Responses should still be filtered by `deviceid`.

## Docker support expectations

This feature set is specifically intended to allow Homebridge-in-Docker deployments to control DoHome devices.

Recommended documentation guidance (not necessarily new code):

- Docker Desktop (macOS/Windows): prefer `host` (direct IP).
- Linux:
  - direct IP works with bridge networking when routing is available.
  - broadcast may work with `--network host`.

## Backwards compatibility

- Existing configs using only `subnet` should keep working without changes.
- `subnet` remains in schema and README, but is clarified as “UDP destination (usually broadcast)”.

## Additional refactor requirements (good practices)

These refactors are included in scope because they reduce runtime risk and make the new feature testable:

- Replace deprecated `new Buffer(...)` with `Buffer.from(...)`.
- Fix callback usage so Homebridge callbacks are invoked exactly once.
- Remove references to undefined variables in logs.
- Make the UDP layer testable (e.g., dependency injection for `dgram` or extracting parsing logic into pure functions).
- Prefer strict parsing + safe error handling:
  - ignore/handle malformed `op=` JSON rather than crashing.

## Acceptance criteria

- With `host` set, ON/OFF and initial state work in a network where broadcast is blocked.
- With only `subnet` set, behavior remains unchanged (still works for current users).
- No deprecated Buffer API usage remains.
- Unit tests cover destination selection, broadcast enabling, response filtering, and state mapping.

## Homebridge v2.0 implications (from the official plugin template)

The official Homebridge plugin template includes explicit guidance for the Homebridge v2.0 transition:

- During the transition period, configure your plugin so it will **build and run on both Homebridge v1 and v2 beta**.
  - Template guidance uses:
    - `package.json -> engines.homebridge`: `"^1.8.0 || ^2.0.0-beta.0"`
    - `package.json -> devDependencies.homebridge`: `"^2.0.0-beta.0"` (or a newer v2 beta)
  - Once Homebridge v2.0 is fully released, the template indicates you can remove the `-beta.0` suffix in both places.

- Node.js version expectations are modern.
  - The template’s `engines.node` targets current Node releases (for example `^20.18.0 || ^22.10.0 || ^24.0.0`).
  - The template README states you should have Node.js 20 or later for development.

### What this means for this plugin

- The direct IP feature should be implemented in a way that is compatible with modern Node runtimes.
- As part of the modernization effort, we should align `package.json` engine ranges and adopt a build/test toolchain that works cleanly on modern Node.
- Migrating to TypeScript/ESM is optional, but adopting the template’s practices (linting, deterministic builds, and testability) is strongly recommended.
