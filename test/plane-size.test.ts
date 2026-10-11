import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutPlane, planeTexts} from '../lib/plane.ts';
import {ROLES} from '../lib/tokens.ts';
import type {PlaneBand} from '../lib/types.ts';

const band: PlaneBand = {type: 'plane', x: {max: 10, label: 'X'}, y: {max: 10, label: 'Y'}, height: 400, points: [{id: 'p', at: [5, 5], label: 'Point'}]};
const widthOf = (_atom: string, size: number) => size * 0.5; // width follows the size it is asked for

test('plane measures and lays out at the current ROLES.note (fill mode rewrites it)', () => {
  const base = ROLES.note;
  try {
    ROLES.note = base * 2;
    assert.ok(planeTexts(band).every(([, size]) => size === base * 2));
    const laid = layoutPlane(band, 0, 0, 800, widthOf);
    const label = laid.labelBoxes.find(b => b.label === 'Point')!;
    assert.equal(label.w, base * 2 * 0.5, 'measured at the scaled size ("Point" is one atom)');
  } finally {
    ROLES.note = base;
  }
});
