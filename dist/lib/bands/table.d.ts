import * as semantic from '../dsl/qc-semantic.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import { table as build } from '../dsl/table.ts';
import type { LaidOutTable, TableBand, TableColumn, TableOpts, TableRow } from '../types/sequence-table-swimlane.ts';
export { cell } from '../dsl/table.ts';
export declare const tableDefinition: BandDef<TableBand, LaidOutTable>;
export declare function table<const Id extends string = never>(columns: TableColumn[], rows: readonly TableRow[], opts?: TableOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutTable>;
export declare function checkSheet<const Id extends string = never>(...args: Parameters<typeof semantic.checkSheet<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
export declare function matrix<const Id extends string = never>(...args: Parameters<typeof semantic.matrix<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
export declare function raci<const Id extends string = never>(...args: Parameters<typeof semantic.raci<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
export declare function fmea<const Id extends string = never>(...args: Parameters<typeof semantic.fmea<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
export declare function isIsNot<const Id extends string = never>(...args: Parameters<typeof semantic.isIsNot<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
export declare function whyWhyTable<const Id extends string = never>(...args: Parameters<typeof semantic.whyWhyTable<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
export declare function qfd<const Id extends string = never>(...args: Parameters<typeof semantic.qfd<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
export declare function journeyMap<const Id extends string = never>(...args: Parameters<typeof semantic.journeyMap<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
export declare function isIsNotTests<const Id extends string = never>(...args: Parameters<typeof semantic.isIsNotTests<Id>>): WithBandDef<TableBand & import("../strict.ts").Declares<Id> & import("../strict.ts").HandleOf<Id>, LaidOutTable>;
