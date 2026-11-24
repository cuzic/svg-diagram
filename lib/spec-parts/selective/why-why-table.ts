import {defineWhyWhyTablePart} from '../why-why-table.ts';
import {band} from '../../band-def.ts';
import {tableDefinition} from '../../bands/table.ts';
import {whyWhyTable as build} from '../../dsl/qc-semantic.ts';

const whyWhyTable = (...args: Parameters<typeof build>) => band(tableDefinition, build(...args));

export const whyWhyTablePart = /* @__PURE__ */ defineWhyWhyTablePart<ReturnType<typeof whyWhyTable>>(whyWhyTable);
