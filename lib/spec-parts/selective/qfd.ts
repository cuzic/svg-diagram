import {defineQfdPart} from '../qfd.ts';
import {band} from '../../band-def.ts';
import {tableDefinition} from '../../bands/table.ts';
import {qfd as build} from '../../dsl/qc-semantic.ts';

const qfd = (...args: Parameters<typeof build>) => band(tableDefinition, build(...args));

export const qfdPart = /* @__PURE__ */ defineQfdPart<ReturnType<typeof qfd>>(qfd);
