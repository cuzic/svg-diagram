import {defineIsIsNotPart} from '../is-is-not.ts';
import {band} from '../../band-def.ts';
import {tableDefinition} from '../../bands/table.ts';
import {isIsNot as build} from '../../dsl/qc-semantic.ts';

const isIsNot = (...args: Parameters<typeof build>) => band(tableDefinition, build(...args));

export const isIsNotPart = /* @__PURE__ */ defineIsIsNotPart<ReturnType<typeof isIsNot>>(isIsNot);
