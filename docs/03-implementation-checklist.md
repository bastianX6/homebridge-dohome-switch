# Implementation Checklist (Refactor + Direct IP Support)

This checklist is written to be executed as a sequence of small, reviewable PRs.

## 1) Configuration & schema

- [ ] Decide the config key name: `host` (recommended) and optional alias `ip`.
- [ ] Update `config.schema.json`:
  - [ ] Add `host` (string) with description “Direct device IP/host (unicast). Preferred for Docker/segmented networks.”
  - [ ] Optionally add `ip` as alias (or omit alias to avoid confusion).
  - [ ] Update `subnet` title/description to clarify it is a UDP destination (usually broadcast).

## 2) Public behavior (index.js)

- [ ] Parse new config:
  - [ ] `this.host = config.host || config.ip` (or similar).
- [ ] Resolve destination:
  - [ ] `destination = this.host ?? this.subnet`.
- [ ] Ensure characteristic handlers call `callback` exactly once.
- [ ] Fix error logs that reference undefined variables (`response`, `responseBody`).
- [ ] Fix `getServices()` logic that calls `callback()` where `callback` is not defined.
  - [ ] Replace with logging + safe fallback state if initial query fails.

## 3) UDP transport (udp.js)

- [ ] Replace deprecated buffer usage:
  - [ ] `Buffer.from(msg[0], 'ascii')`.
- [ ] Add destination broadcast detection:
  - [ ] function `isBroadcastAddress(host)`:
    - `host === '255.255.255.255'` OR `host.endsWith('.255')` (simple heuristic).
- [ ] Only call `client.setBroadcast(true)` when destination is broadcast.
- [ ] Make parsing more robust:
  - [ ] Safely handle invalid JSON in `op=`.
  - [ ] Do not throw on send errors; propagate via callback.
- [ ] Ensure socket lifecycle is safe:
  - [ ] `client.close()` guarded to avoid double-close.
  - [ ] Ensure the timeout handler does not fire after a successful response (clear timeout).

## 4) Testability improvements

Goal: enable unit tests without requiring real UDP devices.

- [ ] Extract pure helpers into a new module (example: `src/protocol.js` or `lib/protocol.js`):
  - [ ] `buildSetPowerPayload(prodname, on)`
  - [ ] `buildQueryPayload(prodname)`
  - [ ] `parseResponse(messageString)` -> `{ dev, op }`
  - [ ] `mapQueryToOnState(op)`
- [ ] Add dependency injection for UDP socket creation:
  - [ ] In `udp.js`, allow passing a `dgram` implementation (default to `require('dgram')`).
  - [ ] Or export a factory that can be tested with a fake socket.

## 5) Package and tooling (good practices)

- [ ] Align with the official Homebridge plugin template expectations.

### Homebridge v2.0 transition settings

- [ ] Update `package.json -> engines.homebridge` to support both v1 and v2 beta during migration:
  - [ ] `"^1.8.0 || ^2.0.0-beta.0"`
  - [ ] Once Homebridge v2.0 is fully released, remove the `-beta.0` suffix.

### Node.js engines

- [ ] Update `package.json -> engines.node` to a modern range (the template uses `^20.18.0 || ^22.10.0 || ^24.0.0`).
  - [ ] Confirm the minimum Node version that Homebridge v2 will require for this plugin’s support policy.

### Tooling / structure

- [ ] Add scripts consistent with modern plugins:
  - [ ] `build` (if staying JS-only, this can be a no-op; if migrating to TS, compile to `dist/`)
  - [ ] `lint` (ESLint)
  - [ ] `test` (prefer `node --test` to avoid dependencies, or Jest if desired)
  - [ ] `prepublishOnly` to run `lint` + `build` (template pattern)

- [ ] Consider adopting TypeScript + `dist/` output (template pattern):
  - [ ] If adopted, consider ESM (`"type": "module"`) to match the template.
  - [ ] If not adopted, still remove deprecated APIs and add tests.

## 6) Documentation updates

- [ ] Update main README to include `host` usage and Docker recommendations.
- [ ] Keep existing broadcast config documented for backwards compatibility.

## 7) Release checklist

- [ ] Run unit tests.
- [ ] Validate with a real device on:
  - [ ] LAN broadcast mode
  - [ ] Direct IP mode
  - [ ] Homebridge in Docker (at least one environment)
- [ ] Bump version and update changelog/release notes.
