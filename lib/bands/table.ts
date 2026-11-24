import * as semantic from '../dsl/qc-semantic.ts';
import {analysisFindings} from '../finding-rules.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {table as build} from '../dsl/sequence-table-swimlane.ts';
import {renderTable} from '../emit-tables.ts';
import {snapGrid} from '../layout-util.ts';
import {rowHeaderFindings, semanticTableFindings} from '../table-rules.ts';
import {layoutTable, tableTexts} from '../seq-table.ts';
import type {LaidOutTable, TableBand, TableColumn, TableOpts, TableRow} from '../types/sequence-table-swimlane.ts';

export {cell} from '../dsl/sequence-table-swimlane.ts';

export const tableDefinition: BandDef<TableBand, LaidOutTable> = {
  type: 'table',
  textSizes: band => [band.bodySize],
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of tableTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const laid = layoutTable(data, x, snapGrid(y), w, widthOf, roles, wrap);
    return {laid, h: laid.h};
  },
  emit: (laid, {theme, tones, roles}) => renderTable(laid, theme, tones, roles),
  verify: {
    findings: data => [...analysisFindings(data, data.rca?.findings ?? []), ...semanticTableFindings(data)],
    layoutFindings: (laid, {tones}) => rowHeaderFindings(laid, tones),
  },
  svgDefs: laid => ({mono: laid.rows.some(row => row.cells.some(cell => cell.mono && cell.lines.length))}),
};

function attachTable<D extends TableBand>(data: D): WithBandDef<D, LaidOutTable> {
  return band<D, LaidOutTable>(tableDefinition, data);
}

export function table<const Id extends string = never>(columns: TableColumn[], rows: readonly TableRow[], opts?: TableOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutTable> {
  return attachTable(build<Id>(columns, rows, opts));
}

export function checkSheet<const Id extends string = never>(...args: Parameters<typeof semantic.checkSheet<Id>>) {
  return attachTable(semantic.checkSheet<Id>(...args));
}

export function matrix<const Id extends string = never>(...args: Parameters<typeof semantic.matrix<Id>>) {
  return attachTable(semantic.matrix<Id>(...args));
}

export function raci<const Id extends string = never>(...args: Parameters<typeof semantic.raci<Id>>) {
  return attachTable(semantic.raci<Id>(...args));
}

export function fmea<const Id extends string = never>(...args: Parameters<typeof semantic.fmea<Id>>) {
  return attachTable(semantic.fmea<Id>(...args));
}

export function isIsNot<const Id extends string = never>(...args: Parameters<typeof semantic.isIsNot<Id>>) {
  return attachTable(semantic.isIsNot<Id>(...args));
}

export function whyWhyTable<const Id extends string = never>(...args: Parameters<typeof semantic.whyWhyTable<Id>>) {
  return attachTable(semantic.whyWhyTable<Id>(...args));
}

export function qfd<const Id extends string = never>(...args: Parameters<typeof semantic.qfd<Id>>) {
  return attachTable(semantic.qfd<Id>(...args));
}

export function journeyMap<const Id extends string = never>(...args: Parameters<typeof semantic.journeyMap<Id>>) {
  return attachTable(semantic.journeyMap<Id>(...args));
}

export function isIsNotTests<const Id extends string = never>(...args: Parameters<typeof semantic.isIsNotTests<Id>>) {
  return attachTable(semantic.isIsNotTests<Id>(...args));
}
