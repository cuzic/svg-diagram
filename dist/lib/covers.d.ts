export interface Cell {
    text: string;
    line: number;
}
export interface Uncovered {
    cell: Cell;
    missing: string[];
}
export declare const normalize: (s: string) => string;
export declare const tokensOf: (cell: string) => string[];
export declare function readTable(text: string, kind: 'md' | 'csv'): Cell[];
export declare function figureText(svg: string): string;
export declare function checkCovers(cells: Cell[], figure: string): Uncovered[];
/**
 * The other way round (`check --docs --fidelity`): the numbers (two digits or more) and Latin words of the figure's text that none of the document texts
 * mentions -- a figure should not carry a number or a term the page never states. The texts are the page and, with `--base`, its older version.
 */
export declare function checkFidelity(figure: string, ...docs: string[]): string[];
