export interface ParsedResponse {
  dev?: string;
  op?: unknown;
}

export const buildSetPowerPayload = (prodname: string, on: boolean): string => {
  return `cmd=ctrl&devices={[${prodname}]}&op={"cmd":5,"op":${on ? 1 : 0}}`;
};

export const buildQueryPayload = (prodname: string): string => {
  return `cmd=ctrl&devices={[${prodname}]}&op={"cmd":25}`;
};

export const parseResponse = (message: string): ParsedResponse | null => {
  try {
    const result: ParsedResponse = {};
    const parts = message.split('&');
    for (const part of parts) {
      const [key, rawValue] = part.split('=');
      if (!key || rawValue === undefined) continue;
      if (key === 'dev') {
        result.dev = rawValue;
      }
      if (key === 'op') {
        try {
          result.op = JSON.parse(rawValue);
        } catch {
          return null;
        }
      }
    }
    if (!result.dev && !result.op) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
};

export const mapQueryToOnState = (
  op: unknown,
  previousState: boolean | undefined,
): boolean => {
  if (typeof op !== 'object' || op === null) {
    return previousState ?? false;
  }

  const maybePoweroff = (op as Record<string, unknown>).soft_poweroff;
  if (maybePoweroff === 0) return true;
  if (maybePoweroff === 1) return false;

  return previousState ?? false;
};

export const isBroadcastAddress = (host: string): boolean => {
  return host === '255.255.255.255' || host.endsWith('.255');
};
