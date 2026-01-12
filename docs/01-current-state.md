# Current Project State (as of 2026-01-11)

## Summary

This repository is a Homebridge accessory plugin that controls DoHome/Doit smart plugs via a proprietary UDP protocol.

- Plugin type: Homebridge `accessory`
- Accessory name: `DoHomeSwitch`
- Primary HomeKit service: `Service.Switch`
- Transport: UDP (`dgram`), no dependencies

## User-facing behavior

- Exposes a single On/Off switch in HomeKit.
- Sends UDP packets to a configured destination (historically called `subnet`).
- Reads the initial state during Homebridge startup.

## Configuration semantics (real behavior)

The current config keys do **not** fully match their names:

- `subnet`
  - Not a CIDR subnet.
  - It is the UDP destination host.
  - In practice it is commonly set to the LAN broadcast address, e.g. `192.168.0.255`.

- `prodname`
  - A short device selector injected into the payload: `devices={[<prodname>]}`.
  - Often the last 4 MAC characters, but not guaranteed.

- `deviceid`
  - Used to filter responses.
  - The UDP response contains a `dev=` field; the plugin only accepts responses where `dev=<deviceid>`.

- `port`
  - Defaults to `6091`.

## Protocol / message flow

### Commands

- Set power state:
  - ON: `op={"cmd":5, "op":1}`
  - OFF: `op={"cmd":5, "op":0}`

- Query state (startup):
  - `op={"cmd":25}`

### High-level control flow

1. Homebridge loads the accessory and calls `getServices()`.
2. The plugin creates `Service.Switch`.
3. Startup state: sends the query command and retries up to 10 times if it times out.
4. On HomeKit On/Off changes: sends the power command.
5. UDP response handling:
   - Parses the response key-value pairs.
   - Verifies `dev` matches `deviceid`.
   - For startup query, maps `op.soft_poweroff` to a boolean switch state.

## Why it breaks in Docker / segmented networks

The plugin relies on UDP broadcast behavior that often fails or is blocked:

- Docker bridge/NAT networking typically does not forward broadcast to the physical LAN.
- VLAN/segmented networks often filter broadcast.
- Some environments block broadcast entirely.

## Technical debt / known issues

These are present in the current codebase and should be addressed as part of the refactor:

- Deprecated APIs
  - `udp.js` uses `new Buffer(...)` which is deprecated in modern Node.

- Error handling / correctness
  - `index.js` references non-existent variables (`response`, `responseBody`) in some error logs.
  - `getServices()` contains `callback()` invocations where `callback` is not defined in that scope (potential `ReferenceError` depending on execution paths).
  - Some code paths call `callback()` more than once (should be exactly once in Homebridge characteristic handlers).

- Hard-coded timings
  - Retries and timeouts are hard-coded in `udp.js`.

- Outdated `engines` metadata
  - `package.json` declares very old Node/Homebridge versions, which does not reflect typical modern Homebridge deployments.

## Gap vs. the official Homebridge plugin template

The official Homebridge plugin template (homebridge/homebridge-plugin-template) represents the current recommended baseline for plugin development. Compared to that template, this repository differs in several ways:

- Project layout & tooling
  - This repo is plain JavaScript with no build step.
  - The template uses TypeScript compiled to `dist/`, with ESLint and scripts like `build`, `lint`, and `prepublishOnly`.

- Module system
  - This repo is CommonJS.
  - The template is ESM (`"type": "module"`).

- Engine / version guidance
  - This repo declares a very old Node/Homebridge engine range.
  - The template declares modern Node ranges and sets `engines.homebridge` to support both Homebridge v1 and v2 beta during the transition.

These gaps are not necessarily “wrong”, but they increase migration risk and make testing/refactoring harder.

## Constraints to preserve

- Backwards compatibility for existing users:
  - Existing configs that only set `subnet` should keep working.
- Keep filtering responses by `deviceid` to avoid cross-device responses.
