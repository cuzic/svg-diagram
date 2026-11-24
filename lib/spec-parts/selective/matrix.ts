import {defineMatrixPart} from '../matrix.ts';
import {band} from '../../band-def.ts';
import {tableDefinition, table} from '../../bands/table.ts';
import {matrix as build} from '../../dsl/qc-semantic.ts';

const matrix = (...args: Parameters<typeof build>) => band(tableDefinition, build(...args));

export const matrixPart = /* @__PURE__ */ defineMatrixPart<ReturnType<typeof matrix> | ReturnType<typeof table>>(matrix, table);
