import type { FontFamily, MeasureRequest, Measured } from './types.ts';
export declare function splitAtoms(text: string): string[];
export declare function closeMeasurer(): Promise<void>;
export declare function measureAll(requests: Map<string, MeasureRequest>): Promise<Map<string, Measured>>;
export declare function measureAtoms(strings: Iterable<string>, { size, weight, font }: {
    size: number;
    weight?: number;
    font?: FontFamily;
}): Promise<{
    width: (atom: string) => number;
    height: (atom: string) => number;
    raw: Map<string, Measured>;
}>;
