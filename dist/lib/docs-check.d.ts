import type { DocImage, DocNoteItem, Finding, WfNote, Band } from './types.ts';
export declare function scanMarkdown(text: string): DocImage[];
export declare function parseItem(raw: string): {
    title: string;
    text: string;
};
export declare function compareNotes(items: DocNoteItem[], notes: WfNote[], where: string): Finding[];
export declare function notesOf(bands: Band[]): WfNote[][];
export declare function formatNotes(notes: WfNote[]): string;
export interface MapRow {
    name: string;
    svg: string;
    doc: string;
    src: string;
}
export declare function formatMap(rows: MapRow[]): string;
