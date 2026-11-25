import {defineTablePart} from '../table.ts';
import {table} from '../../bands/table.ts';

export const tablePart = /* @__PURE__ */ defineTablePart<ReturnType<typeof table>>(table);
