import type { DiagramData } from './types/core.ts';
/** An explicit title wins; otherwise take the first eligible band at the best priority. */
export declare function definedDiagramTitle({ title, bands }: Pick<DiagramData, 'title' | 'bands'>, stage?: number): string;
