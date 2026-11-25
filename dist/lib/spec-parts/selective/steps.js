import { connectDefinition } from '../../bands/connect.js';
import { steps } from '../../bands/row.js';
import { defineStepsPart } from '../steps.js';
export const stepsPart = {
    ...defineStepsPart(steps),
    connectors: connectDefinition,
};
