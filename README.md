# homebridge-dohome-switch

Homebridge plugin to control DoHome (Doit / DoHome) power plugs/switches via UDP.

This repository supports **direct device IP (`host`)** or legacy **UDP broadcast** (historical `subnet`) and **filters responses by `deviceid`**.

## How it works today (summary)

- Exposes a HomeKit `Service.Switch` (On/Off).
- To turn on/off, sends a UDP packet to the configured `subnet` (usually a broadcast address like `x.x.x.255`) on port `6091`.
- The device answers via UDP and the plugin validates that the `dev=` field in the response matches `deviceid`.
- To fetch the initial state (when Homebridge starts), it sends a status query and retries several times on timeout.

Key limitation: **without working UDP broadcast, the plugin cannot discover or control the device** (this matters for Docker, segmented networks, or VLANs).

## Installation

1. Install Homebridge.
2. Install this plugin: `npm install -g homebridge-dohome-switch`
3. Configure the accessory in `config.json`.

## Configuration

Example (direct IP / recommended for Docker or segmented networks):

```json
{
    "accessory": "DoHomeSwitch",
    "name": "DoHome Plug",
    "prodname": "65ff",
  "host": "192.168.0.42",
    "port": 6091,
    "deviceid": "955sga0g65ff_DT-PLUG_HOMEKIT"
}
```

Legacy broadcast example:

```json
{
  "accessory": "DoHomeSwitch",
  "name": "DoHome Plug",
  "prodname": "65ff",
  "subnet": "192.168.0.255",
  "port": 6091,
  "deviceid": "955sga0g65ff_DT-PLUG_HOMEKIT"
}
```

### Parameters

| Parameter | Description | Required |
| --- | --- | :---: |
| `accessory` | Must be `DoHomeSwitch` | ✓ |
| `name` | Name shown in HomeKit | ✓ |
| `prodname` | Short device identifier; on many models it matches the **last 4 characters of the MAC** | ✓ |
| `host` | Direct device IP/host (unicast). Recommended for Docker and segmented networks. | ✓ (or `subnet`) |
| `subnet` | **Broadcast address** for legacy behavior (e.g. `192.168.0.255`). Used only if `host` is not provided. | ✓ (unless `host` is set) |
| `port` | Device UDP port (default `6091`) | |
| `deviceid` | Full device ID reported as `dev=`. Used to filter UDP responses and avoid mixing devices. | Recommended |

Notes:

- If you don’t set `deviceid`, the code builds a default like `${prodname}_DT-PLUG_HOMEKIT`.
- If you have multiple devices, **each accessory should use the correct `prodname` and `deviceid`**, otherwise it may time out or read the wrong state.

## Troubleshooting

- **Constant timeout**:
  - If using `host`, verify the IP is reachable and stable (consider DHCP reservation).
  - If using `subnet`, make sure it is the broadcast address and broadcast is allowed on your network.
  - Confirm the real `deviceid` by capturing UDP traffic (Wireshark/tcpdump) and looking for the `dev=` field in the response.

## Docker guidance

- Docker Desktop (macOS/Windows): prefer `host` (direct IP) because broadcast is usually filtered.
- Linux: direct IP works on bridge networks; broadcast may work with `--network host` if you still want it.

## Implementation notes

- Transport: UDP with retries at 0/250/500/750/1000 ms and timeout at ~1.25s.
- Broadcast is enabled only when the destination looks like a broadcast address (`255.255.255.255` or ends with `.255`).
- Startup query maps `soft_poweroff === 0` to On=true, `1` to On=false, and otherwise keeps the last known state.
