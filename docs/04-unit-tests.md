# Unit Test Plan

## Testing goals

The unit tests should validate that:

- Destination selection chooses `host`/`ip` over `subnet`.
- Broadcast enabling is conditional and correct.
- UDP response filtering by `deviceid` is enforced.
- Startup query mapping (`cmd:25` / `soft_poweroff`) produces the correct HomeKit `On` state.
- Timeouts and retries behave deterministically.

## Recommended test framework

Prefer using Node’s built-in test runner to avoid extra dependencies:

- Node >= 20: `node --test`
- Assertions: `node:assert/strict`

Alternative (if the project prefers): Jest.

## Test strategy

### 1) Make protocol logic pure

Refactor so that building/parsing logic lives in pure functions (no sockets):

- `buildSetPowerPayload(prodname, on)`
- `buildQueryPayload(prodname)`
- `parseResponse(str)` -> `{ dev, op }`
- `mapQueryToOnState(op)` -> boolean

These functions can be tested with simple string inputs.

### 2) Mock the UDP socket

For `udp.js`, avoid real network IO:

- Inject a fake `dgram` implementation or a socket factory.
- The fake socket should implement:
  - `bind(cb)`
  - `setBroadcast(flag)`
  - `send(buf, offset, length, port, host, cb)`
  - `on('message', handler)`
  - `close()`
  - `address()` (optional)

The fake should let the test:

- capture the last `host`, `port`, and payload sent
- trigger a `message` event with an arbitrary response string
- simulate send errors
- simulate timeouts (advance timers)

### 3) Use fake timers

To test retry/timeout logic deterministically, use a fake timer mechanism.

- With Node’s test runner, you can structure the code so retries are scheduled via an injected `setTimeout`/`clearTimeout` (or use a library; but for minimal deps, prefer injection).

## Test cases (minimum set)

### A. Destination selection

1. `host` set -> sends to `host` (unicast)
   - Given config `{ host: '192.168.0.42', subnet: '192.168.0.255' }`
   - Expect UDP destination host = `192.168.0.42`

2. `ip` set (alias) -> sends to `ip`

3. Neither `host` nor `ip` set -> falls back to `subnet`

### B. Broadcast enabling

4. Destination `192.168.0.255` -> broadcast enabled

5. Destination `255.255.255.255` -> broadcast enabled

6. Destination `192.168.0.42` -> broadcast NOT enabled

### C. Response filtering by `deviceid`

7. Response `dev=<expected>` -> callback called with parsed result

8. Response `dev=<other>` -> ignored (no callback until timeout)

### D. Startup state mapping

9. Query response `op={"soft_poweroff":0}` -> `On === true`

10. Query response `op={"soft_poweroff":1}` -> `On === false`

11. Query response missing `soft_poweroff` -> choose a safe default (documented behavior) and test it

### E. Robust parsing

12. Malformed `op=` JSON -> does not crash; ignored or handled; eventually times out

13. Response missing `dev=` -> ignored; eventually times out

### F. Timeout and retries

14. No matching response -> callback receives `"timeout"` exactly once

15. Matching response arrives before timeout -> timeout is cancelled and callback called once

16. Verify retry schedule: sends N times at expected intervals (if you keep the current 250/500/750/1000ms scheme)

## Quality gates

- All tests pass on Node 20 and Node 22 (and any additional Node versions the project declares in `engines.node`).
- No tests perform real UDP IO.
- No test relies on wall-clock delays.

## Homebridge v2.0 migration note

The official Homebridge plugin template targets Node 20+ for development and uses modern tooling. Even if this project stays JavaScript/CommonJS for now, unit tests should run cleanly on the Node versions declared in `package.json -> engines.node`, and should not depend on deprecated APIs.

## Suggested folder layout (when implementing)

- `test/`
  - `protocol.test.js`
  - `udp.test.js`
  - `index.test.js` (optional; mostly integration-like with mocks)
