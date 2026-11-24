import {band} from '../../band-def.ts';
import {boxDefinition} from '../../bands/box.ts';
import {connectDefinition} from '../../bands/connect.ts';
import {rowDefinition} from '../../bands/row.ts';
import {steps as build} from '../../steps.ts';
import {defineStepsPart} from '../steps.ts';

const steps = (...args: Parameters<typeof build>) => {
  const row = build(...args);
  return band(rowDefinition, {...row, children: row.children.map(child => band(boxDefinition, child))});
};

export const stepsPart = {
  ...defineStepsPart(steps),
  connectors: connectDefinition,
};
