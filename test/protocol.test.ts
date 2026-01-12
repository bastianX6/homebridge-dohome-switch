import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQueryPayload,
  buildSetPowerPayload,
  isBroadcastAddress,
  mapQueryToOnState,
  parseResponse,
} from '../src/protocol.js';

test('buildSetPowerPayload builds correct op', () => {
  const payload = buildSetPowerPayload('abcd', true);
  assert.equal(payload, 'cmd=ctrl&devices={[abcd]}&op={"cmd":5,"op":1}');
});

test('buildQueryPayload builds correct op', () => {
  const payload = buildQueryPayload('abcd');
  assert.equal(payload, 'cmd=ctrl&devices={[abcd]}&op={"cmd":25}');
});

test('parseResponse parses dev and op', () => {
  const parsed = parseResponse('dev=xyz&op={"soft_poweroff":0}');
  assert.deepEqual(parsed, { dev: 'xyz', op: { soft_poweroff: 0 } });
});

test('parseResponse returns null on invalid JSON', () => {
  const parsed = parseResponse('dev=xyz&op={bad json');
  assert.equal(parsed, null);
});

test('mapQueryToOnState maps soft_poweroff values', () => {
  assert.equal(mapQueryToOnState({ soft_poweroff: 0 }, false), true);
  assert.equal(mapQueryToOnState({ soft_poweroff: 1 }, true), false);
});

test('mapQueryToOnState falls back to previous state when missing', () => {
  assert.equal(mapQueryToOnState({}, true), true);
  assert.equal(mapQueryToOnState({}, undefined), false);
});

test('isBroadcastAddress detects common broadcast patterns', () => {
  assert.equal(isBroadcastAddress('192.168.0.255'), true);
  assert.equal(isBroadcastAddress('255.255.255.255'), true);
  assert.equal(isBroadcastAddress('192.168.0.42'), false);
});
