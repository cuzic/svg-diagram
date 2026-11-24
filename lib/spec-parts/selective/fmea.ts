import {defineFmeaPart} from '../fmea.ts';
import {band} from '../../band-def.ts';
import {tableDefinition} from '../../bands/table.ts';
import {fmea as build} from '../../dsl/qc-semantic.ts';

const fmea = (...args: Parameters<typeof build>) => band(tableDefinition, build(...args));

export const fmeaPart = /* @__PURE__ */ defineFmeaPart<ReturnType<typeof fmea>>(fmea);
