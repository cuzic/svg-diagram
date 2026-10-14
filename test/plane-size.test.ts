import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutPlane, planeTexts} from '../lib/plane.ts';
import {ROLES, scaleRoles} from '../lib/tokens.ts';
import type {PlaneBand} from '../lib/types/figures.ts';

const band: PlaneBand = {type: 'plane', x: {max: 10, label: 'X'}, y: {max: 10, label: 'Y'}, height: 400, points: [{id: 'p', at: [5, 5], label: 'Point'}]};
const widthOf = (_atom: string, size: number) => size * 0.5; // width follows the size it is asked for

test('plane measures and lays out at the roles it is given (fill mode passes scaled ones)', () => {
  const roles = scaleRoles(ROLES, 2);
  assert.ok(planeTexts(band, roles).every(([, size]) => size === ROLES.note * 2));
  const laid = layoutPlane(band, 0, 0, 800, widthOf, roles);
  const label = laid.labelBoxes.find(b => b.label === 'Point')!;
  assert.equal(label.w, ROLES.note * 2 * 0.5, 'measured at the scaled size ("Point" is one atom)');
});
