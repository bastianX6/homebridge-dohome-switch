import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { sendUdpRequest } from '../src/udp.js';

class FakeSocket extends EventEmitter {
  public broadcastEnabled = false;
  public closed = false;
  public sent: Array<{ host: string; port: number; payload: string }> = [];

  bind(cb?: () => void): void {
    cb?.();
  }

  setBroadcast(flag: boolean): void {
    this.broadcastEnabled = flag;
  }

  send(
    buf: Buffer,
    _offset: number,
    _length: number,
    port: number,
    host: string,
    cb?: (err?: Error | null) => void,
  ): void {
    if (this.closed) return;
    this.sent.push({ host, port, payload: buf.toString('ascii') });
    cb?.();
  }

  close(): void {
    this.closed = true;
  }
}

class FakeDgram {
  public sockets: FakeSocket[] = [];

  createSocket(): FakeSocket {
    const socket = new FakeSocket();
    this.sockets.push(socket);
    return socket;
  }
}

test('enables broadcast for .255 destination and returns state for matching device', async () => {
  const fakeDgram = new FakeDgram();
  const request = sendUdpRequest({
    host: '192.168.0.255',
    port: 6091,
    payload: 'cmd=ctrl&devices={[abcd]}&op={"cmd":25}',
    deviceId: 'device123',
    mode: 'query',
    dgramFactory: fakeDgram,
    retriesMs: [0],
    timeoutMs: 200,
    mapQueryToState: () => true,
  });

  const socket = fakeDgram.sockets[0];
  // Simulate device response
  socket.emit('message', Buffer.from('dev=device123&op={"soft_poweroff":0}'), {
    address: '1.1.1.1',
    port: 6091,
  });

  const result = await request;
  assert.equal(socket.broadcastEnabled, true);
  assert.equal(result.ok, true);
  assert.equal(result.state, true);
});

test('does not enable broadcast for unicast destination', async () => {
  const fakeDgram = new FakeDgram();
  const pending = sendUdpRequest({
    host: '192.168.0.42',
    port: 6091,
    payload: 'cmd=ctrl&devices={[abcd]}&op={"cmd":25}',
    deviceId: 'device123',
    mode: 'query',
    dgramFactory: fakeDgram,
    retriesMs: [0],
    timeoutMs: 100,
    mapQueryToState: () => true,
  });

  const socket = fakeDgram.sockets[0];
  socket.emit('message', Buffer.from('dev=device123&op={"soft_poweroff":1}'), {
    address: '1.1.1.1',
    port: 6091,
  });

  const result = await pending;
  assert.equal(socket.broadcastEnabled, false);
  assert.equal(result.ok, true);
  assert.equal(result.state, true); // mapQueryToState returns true regardless
});

test('ignores responses from other device ids and times out', async () => {
  const fakeDgram = new FakeDgram();
  const result = await sendUdpRequest({
    host: '192.168.0.42',
    port: 6091,
    payload: 'cmd=ctrl&devices={[abcd]}&op={"cmd":25}',
    deviceId: 'expected',
    mode: 'query',
    dgramFactory: fakeDgram,
    retriesMs: [0],
    timeoutMs: 50,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'timeout');
});

test('returns ack info for set mode', async () => {
  const fakeDgram = new FakeDgram();
  const request = sendUdpRequest({
    host: '192.168.0.42',
    port: 6091,
    payload: 'cmd=ctrl&devices={[abcd]}&op={"cmd":5,"op":1}',
    deviceId: 'expected',
    mode: 'set',
    dgramFactory: fakeDgram,
    retriesMs: [0],
    timeoutMs: 200,
  });

  const socket = fakeDgram.sockets[0];
  socket.emit('message', Buffer.from('dev=expected&op={"soft_poweroff":0}'), {
    address: '1.1.1.1',
    port: 6091,
  });

  const result = await request;
  assert.equal(result.ok, true);
  assert.match(result.info ?? '', /1\.1\.1\.1:6091/);
});
