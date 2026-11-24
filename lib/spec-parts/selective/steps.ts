import {connectDefinition} from '../../bands/connect.ts';
import {steps} from '../../bands/row.ts';
import {defineStepsPart} from '../steps.ts';

export const stepsPart = {
  ...defineStepsPart(steps),
  connectors: connectDefinition,
};
