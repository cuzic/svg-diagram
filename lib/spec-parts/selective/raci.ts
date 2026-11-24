import {defineRaciPart} from '../raci.ts';
import {band} from '../../band-def.ts';
import {tableDefinition} from '../../bands/table.ts';
import {raci as build} from '../../dsl/qc-semantic.ts';

const raci = (...args: Parameters<typeof build>) => band(tableDefinition, build(...args));

export const raciPart = /* @__PURE__ */ defineRaciPart<ReturnType<typeof raci>>(raci);
