import {defineMatrixPart} from '../matrix.ts';
import {matrix, table} from '../../bands/table.ts';

export const matrixPart = /* @__PURE__ */ defineMatrixPart<ReturnType<typeof matrix> | ReturnType<typeof table>>(matrix, table);
