import type { Band } from './types/index.ts';
import type { DocImage, DocNoteItem } from './types/project.ts';
import type { Finding } from './types/verdicts.ts';
import type { WfNote } from './types/wireframe.ts';
export declare function scanPngRefs(text: string): {
    line: number;
    alt: string;
    ref: string;
}[];
export declare function scanMarkdown(text: string): DocImage[];
export declare function parseItem(raw: string): {
    title: string;
    text: string;
};
export declare function compareNotes(items: DocNoteItem[], notes: WfNote[], where: string): Finding[];
export declare function notesOf(bands: Band[]): WfNote[][];
export declare function formatNotes(notes: WfNote[]): string;
export declare function chapterOf(file: string): number | null;
export interface DocFinding extends Finding {
    line?: number;
}
export declare function checkFigures(text: string, figs: DocImage[], chapter: number | null): DocFinding[];
export declare function globToRegExp(glob: string): RegExp;
export declare const matchesAny: (globs: RegExp[], rel: string) => boolean;
export interface MapRow {
    name: string;
    svg: string;
    doc: string;
    src: string;
}
export declare function formatMap(rows: MapRow[]): string;
