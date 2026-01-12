# AGENTS.md

This document is intended for agents (humans or assistants) who will evolve this repository. It summarizes the current state of the plugin, how it works at the protocol level, and where to make changes.

## Project summary

- Type: Homebridge plugin (pluginType: `accessory`).
- Alias/Accessory: `DoHomeSwitch`.
- Purpose: expose a HomeKit `Service.Switch` to control DoHome power plugs/switches.
- Transport: UDP (Node `dgram`) with no external dependencies.

## Files and responsibilities

Current structure (TypeScript, ESM):

- `src/index.ts`
  - Registers the accessory in Homebridge (`DoHomeSwitch`).
  - Parses config (`name`, `prodname`, `host`, `subnet`, `port`, `deviceid`).
  - Resolves destination: `host` (unicast) if present, else `subnet` (broadcast-compatible).
  - Builds power/query payloads via protocol helpers.
  - Startup query maps `soft_poweroff` to `Characteristic.On`; if missing, keeps last known state.

- `src/protocol.ts`
  - Pure helpers: `buildSetPowerPayload`, `buildQueryPayload`, `parseResponse`, `mapQueryToOnState`, `isBroadcastAddress`.

- `src/udp.ts`
  - UDP transport with retries (0/250/500/750/1000 ms) and timeout (~1250 ms).
  - Conditional broadcast (`setBroadcast(true)`) only when destination appears broadcast (`255.255.255.255` or endsWith `.255`).
  - Filters responses by `deviceId` and supports injected dgram for tests.

- `config.schema.json`
  - Homebridge UI schema including `host` (unicast) and legacy `subnet`.

- `test/`
  - Node `--test` suites for protocol and UDP behavior using fake dgram sockets.

- `tsconfig.json`
  - Emits ESM to `dist/`.

## Configuration semantics

- `prodname`: inserted into the payload to select the device (`devices={[<prodname>]}`); often last 4 MAC characters but not guaranteed.
- `deviceid`: used to validate that the UDP response belongs to the correct device (`dev=` field).
- `host`: direct device IP/hostname (unicast).
- `subnet`: UDP destination host (legacy broadcast, e.g., `192.168.0.255`); used only if `host` is absent.
- `port`: defaults to `6091`.

## Control flow (high level)

1. Homebridge loads the accessory and calls `getServices()` (in `src/index.ts`).
2. The plugin creates a `Service.Switch`.
3. Startup query: sends `cmd=25` with retries; maps `soft_poweroff` 0→On, 1→Off; missing/invalid keeps last known state.
4. State changes: on `Characteristic.On` set, sends `cmd=5` with `op` 1|0.
5. `src/udp.ts` filters responses by `deviceid`; broadcast enabled only for broadcast-looking destinations.

## Notes / current state

- Codebase migrated to TypeScript + ESM; entrypoint `dist/index.js` after build.
- Engines: Node `^20.18.0 || ^22.10.0 || ^24.0.0`, Homebridge `^1.8.0 || ^2.0.0-beta.0`.
- Tests: Node built-in `--test`, fake dgram for UDP.
- Retains retries/timeouts as before (0/250/500/750/1000 ms, timeout ~1250 ms) for behavioral compatibility.

## Direct IP vs broadcast

- Destination rule: `host` (unicast) takes precedence; `subnet` is legacy (usually broadcast).
- Broadcast is enabled only when destination looks like broadcast.
- `deviceid` filtering remains mandatory to avoid cross-device responses.
- No discovery in unicast mode; recommend DHCP reservations for stable IPs.

## Docker: execution and networking

### Problem

- With `--network bridge`, broadcast typically does not reach the physical LAN.

### Alternatives

- Preferred with direct IP: the container only needs L3 reachability to the device.
- On Linux:
  - `--network host` often enables both broadcast and unicast to the LAN.
- On macOS (Docker Desktop):
  - `--network host` does not behave the same as on Linux.
  - Direct IP is usually more reliable than broadcast.

### Docker notes

- Docker Desktop (macOS/Windows): prefer `host` (direct IP).
- Linux: direct IP works on bridge; broadcast may work with `--network host` if needed.

## Validation checklist (current)

- Single device: ON/OFF works with `host` configured.
- Multiple devices: responses filtered by `deviceid`.
- Initial state: `cmd:25` works via unicast/broadcast; missing `soft_poweroff` keeps last state.
- Retries/timeout: unchanged behavior (non-blocking to Homebridge).
- `config.schema.json`: includes `host` with description; `subnet` clarified as destination/broadcast.

