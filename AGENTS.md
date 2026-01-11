# AGENTS.md

This document is intended for agents (humans or assistants) who will evolve this repository. It summarizes the current state of the plugin, how it works at the protocol level, and where to make changes to implement the next improvements.

## Project summary

- Type: Homebridge plugin (pluginType: `accessory`).
- Alias/Accessory: `DoHomeSwitch`.
- Purpose: expose a HomeKit `Service.Switch` to control DoHome power plugs/switches.
- Transport: UDP (Node `dgram`) with no external dependencies.

## Files and responsibilities

- `index.js`
  - Registers the accessory in Homebridge.
  - Parses config (`name`, `prodname`, `subnet`, `port`, `deviceid`).
  - Builds `cmd=ctrl...` messages for ON/OFF.
  - Reads initial state on startup (`op={"cmd":25}`) and sets `Characteristic.On`.

- `udp.js`
  - Sends UDP messages to `subnet`+`port`.
  - Enables broadcast (`client.setBroadcast(true)`), assuming the destination is usually a broadcast address.
  - Retries `send()` multiple times (250ms..1000ms) and times out at ~1250ms.
  - Listens for responses and filters by `deviceid` by comparing the `dev=` field to `msg[1]`.
  - If the message originated from `getServices`, interprets `op.soft_poweroff` and returns a boolean.

- `config.schema.json`
  - Homebridge UI schema.

## Current config (real semantics)

- `prodname`: inserted into the payload to select the device (`devices={[<prodname>]}`).
  - On many models it matches the last 4 characters of the MAC, but it’s not universal.
- `deviceid`: used to validate that the UDP response belongs to the correct device (the `dev=` field).
- `subnet`: **not a subnet** in the CIDR sense; it is the **destination host** used for UDP.
  - Typically configured as the LAN broadcast address: `192.168.0.255`.

## Control flow (high level)

1. Homebridge loads the accessory and calls `getServices()`.
2. The plugin creates a `Service.Switch`.
3. For initial state: sends `op={"cmd":25}` and retries up to 10 times on timeout.
4. For state changes: on `Characteristic.On` `set`, sends `op={"cmd":5,"op":1|0}`.
5. `udp.js` listens for responses. If `dev=` matches `deviceid`, it returns state/ack.

## Notes / technical debt

These notes help avoid surprises when implementing changes:

- Engines in `package.json` are outdated (declares a very old Node version).
- In `index.js` there are logs referencing non-existent variables (`response`, `responseBody`) inside error handlers.
- In `getServices()` there are `callback()` calls in a scope where `callback` is not defined (potential bug/ReferenceError depending on execution path).
- `udp.js` uses `new Buffer(...)` (deprecated in modern Node). It may still work, but it’s technical debt.
- Timeouts/retries are hardcoded.

None of this is fixed as part of this documentation update; it’s recorded as the current state.

## Next goal: support direct IP (no broadcast)

### Motivation

- UDP broadcast commonly fails in:
  - Docker (bridge/NAT networking)
  - VLANs / segmented networks
  - environments where broadcast is filtered

### Minimal configuration proposal

Add a new option (name to be decided):

- `host` or `ip`: string (e.g. `192.168.0.42`)

Suggested rules:

- If `host` is set, send UDP to `host` instead of `subnet`.
- Keep `subnet` for backwards compatibility.
- Enable `setBroadcast(true)` only when the destination is a broadcast address (optional; leaving it always on may work, but conditional is more correct).

### Suggested implementation changes

- `index.js`
  - Read `config.host` (or `config.ip`).
  - In `udpRequest`, choose `destination = host ?? subnet`.
  - Consider whether `deviceid` is still needed (yes: it protects against responses from other devices).

- `udp.js`
  - Accept a unicast `host` without relying on broadcast.
  - (Optional) Simple broadcast detection: if it ends with `.255` or equals `255.255.255.255`, only then enable broadcast.
  - Keep the `deviceid` filter.

### Considerations

- In unicast mode, there is no “discovery”: the user must know the device IP.
- Document that IPs may change with DHCP; recommend DHCP reservations.

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

### Recommendation for the future README

- Explain that on Docker Desktop (macOS/Windows), using `host/ip` is recommended.
- For Linux, mention that `--network host` can enable broadcast if you choose to support it.

## Validation checklist for the future change (direct IP)

- Single device: ON/OFF works with `host` configured.
- Multiple devices: responses are still filtered by `deviceid`.
- Initial state: `cmd:25` query works via unicast.
- Retries/timeout: do not block Homebridge.
- `config.schema.json`: includes the new parameter with a clear description.

