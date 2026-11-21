import type { Band } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
/** The strings of a diagram's bands that are meant to be read (labels, titles, bodies, table cells). */
export declare function textsOf(bands: readonly Band[]): string[];
/** Spellings of one term that differ only by a trailing long vowel mark or by letter case class, inside one diagram. */
export declare function termVariants(texts: readonly string[]): string[][];
/** `terms`: {"ユーザー": ["利用者", "ユーザ"]} — the preferred word and the spellings that should not appear. */
export declare function termFindings(bands: readonly Band[], terms: Readonly<Record<string, readonly string[]>> | undefined): Finding[];
export interface Num {
    value: number;
    decimals: number;
    unit: string;
}
export declare function parseNum(text: string): Num | null;
export declare function tableFindings(bands: readonly Band[]): Finding[];
