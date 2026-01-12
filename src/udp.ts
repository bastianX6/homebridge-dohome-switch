import type dgram from 'node:dgram';
import { isBroadcastAddress, parseResponse } from './protocol.js';

export type UdpMode = 'query' | 'set';

export interface UdpRequestOptions {
  host: string;
  port: number;
  payload: string;
  deviceId: string;
  mode: UdpMode;
  retriesMs?: number[];
  timeoutMs?: number;
  dgramFactory?: { createSocket: (...args: any[]) => any };
  mapQueryToState?: (op: unknown) => boolean | undefined;
}

export type UdpRequestResult =
  | { ok: true; state?: boolean; info?: string }
  | { ok: false; error: Error };

const DEFAULT_RETRIES = [0, 250, 500, 750, 1000];
const DEFAULT_TIMEOUT = 1250;

export const sendUdpRequest = async (
  options: UdpRequestOptions,
): Promise<UdpRequestResult> => {
  const {
    host,
    port,
    payload,
    deviceId,
    mode,
    retriesMs = DEFAULT_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT,
    dgramFactory,
    mapQueryToState,
  } = options;

  const dgramImpl = dgramFactory ?? (await import('node:dgram'));
  const client = dgramImpl.createSocket('udp4');

  const timers: NodeJS.Timeout[] = [];
  let settled = false;

  const cleanUp = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    try {
      client.removeAllListeners();
      client.close();
    } catch {
      /* noop */
    }
  };

  const finish = (result: UdpRequestResult, resolve: (value: UdpRequestResult) => void) => {
    if (settled) return;
    settled = true;
    cleanUp();
    resolve(result);
  };

  return new Promise<UdpRequestResult>((resolve) => {
    client.on('message', (message: Buffer, remote: any) => {
      const parsed = parseResponse(message.toString());
      if (!parsed || parsed.dev !== deviceId) return;

      if (mode === 'query') {
        const state = mapQueryToState ? mapQueryToState(parsed.op) : undefined;
        finish({ ok: true, state }, resolve);
      } else {
        finish({ ok: true, info: `${remote.address}:${remote.port}` }, resolve);
      }
    });

    client.on('error', (err: Error) => {
      finish({ ok: false, error: err }, resolve);
    });

    client.bind(() => {
      if (isBroadcastAddress(host)) {
        client.setBroadcast(true);
      }

      const buffer = Buffer.from(payload, 'ascii');

      for (const delay of retriesMs) {
        const timer = setTimeout(() => {
          if (settled) return;
          client.send(buffer, 0, buffer.length, port, host, (err?: Error | null) => {
            if (err) {
              finish({ ok: false, error: err }, resolve);
            }
          });
        }, delay);
        timers.push(timer);
      }

      const timeoutTimer = setTimeout(() => {
        finish({ ok: false, error: new Error('timeout') }, resolve);
      }, timeoutMs);
      timers.push(timeoutTimer);
    });
  });
};
