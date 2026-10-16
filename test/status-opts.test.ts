// ADR 0022 U3: diagram({status, statusLabel}) is validated where sourceLine is, and a figure without a status carries nothing new.
import test from 'node:test';
import assert from 'node:assert/strict';
import {diagram} from '../lib/dsl.ts';

const make = (o: object) => diagram({theme: 'blue', ...o} as never);

test("diagram({status}) takes 'draft' and keeps the label; a figure without one has no status keys", () => {
  const d = make({status: 'draft', statusLabel: '仮説'}) as unknown as Record<string, unknown>;
  assert.equal(d.status, 'draft');
  assert.equal(d.statusLabel, '仮説');
  const plain = make({}) as unknown as Record<string, unknown>;
  assert.equal('status' in plain, false);
  assert.equal('statusLabel' in plain, false);
});

test('diagram({status}) rejects a state other than draft, and a statusLabel that is empty, multi-line or without a status', () => {
  assert.throws(() => make({status: 'final'}), /status\}\) must be 'draft'/);
  assert.throws(() => make({status: 'draft', statusLabel: ''}), /statusLabel\}\) must be a non-empty single-line/);
  assert.throws(() => make({status: 'draft', statusLabel: '  '}), /statusLabel/);
  assert.throws(() => make({status: 'draft', statusLabel: '下書き\n仮'}), /statusLabel/);
  assert.throws(() => make({statusLabel: '仮説'}), /goes with diagram\(\{status\}\)/);
});
