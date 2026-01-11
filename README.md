# homebridge-dohome-switch

Homebridge plugin to control DoHome (Doit / DoHome) power plugs/switches via UDP.

This repository (fork) **currently works by sending UDP broadcast** to a broadcast address on your LAN (for example `192.168.0.255`) and **filtering responses by `deviceid`**.

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

Example (standard on/off switch):

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
| `subnet` | **Broadcast address** for your LAN (e.g. `192.168.0.255`). The parameter name is historical: today it is used as the UDP destination host. | ✓ (unless using direct IP) |
| `port` | Device UDP port (default `6091`) | |
| `deviceid` | Full device ID reported as `dev=`. Used to filter UDP responses and avoid mixing devices. | Recommended |

Notes:

- If you don’t set `deviceid`, the code builds a default like `${prodname}_DT-PLUG_HOMEKIT`.
- If you have multiple devices, **each accessory should use the correct `prodname` and `deviceid`**, otherwise it may time out or read the wrong state.

## Troubleshooting

- **Constant timeout**: usually means broadcast is not reaching the device or `deviceid` does not match.
  - Make sure `subnet` is really your LAN broadcast address (not your router IP).
  - Make sure the device is on the same network/VLAN.
  - Confirm the real `deviceid` by capturing UDP traffic (Wireshark/tcpdump) and looking for the `dev=` field in the response.

## Current code status / technical debt

This fork is focused on working “as-is” with the device UDP protocol, but there are a few things to be aware of:

- The engines declared in `package.json` are very old (`node >= 0.12`, `homebridge >= 0.2`). Modern installs will run on newer runtimes.
- The UDP layer retries by sending the packet multiple times and closes on timeout at ~1.25s.
- Error handling/logging can be improved (for example, some logs reference variables that don’t exist).

## Docker (context)

In containers, UDP broadcast may not reach your physical LAN (or may stay inside the container’s virtual network). That’s why the next planned step for this project is **supporting direct device IP** (no broadcast).

## Roadmap (next changes)

- Allow configuring a device `ip` (or `host`) and send UDP directly to that IP.
- Improve compatibility with Homebridge running in Docker (where broadcast is often problematic).

## References

- homebridge-udp-json-master
- homebridge-udp-multiswitch-master
