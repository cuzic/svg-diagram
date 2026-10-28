#!/usr/bin/env node
export interface DeckEntry {
    file: string | null;
    headings: string[];
}
export declare function resolveDeckOrder(slidesMdPath: string): DeckEntry[];
export declare function countTotalSlides(slidesMdPath: string): number;
export declare function computeSlideIndex(slidesMdPath: string, targetFile: string, headingSubstring: string): number;
