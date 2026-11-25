import type { TableBand } from './types/sequence-table-swimlane.ts';
import type { Finding } from './types/verdicts.ts';
export interface Num {
    value: number;
    decimals: number;
    unit: string;
}
export declare function parseNum(text: string): Num | null;
export declare function tableNumberFindings(t: TableBand): Finding[];
