import {defineCheckSheetPart} from '../check-sheet.ts';
import {band} from '../../band-def.ts';
import {tableDefinition} from '../../bands/table.ts';
import {checkSheet as build} from '../../dsl/qc-semantic.ts';

const checkSheet = (...args: Parameters<typeof build>) => band(tableDefinition, build(...args));

export const checkSheetPart = /* @__PURE__ */ defineCheckSheetPart<ReturnType<typeof checkSheet>>(checkSheet);
