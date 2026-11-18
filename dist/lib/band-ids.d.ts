import type { Band } from './types/index.ts';
/** The names a self-placing band's nodes are registered under (qualified with the band's `scope`, when it has one). */
export declare function nodeIdsOf(b: Band): string[];
/** Every item id a band gives (bare): its nodes, and the bars / marks / steps that layout registers one by one. */
export declare function itemIdsOf(b: Band): string[];
