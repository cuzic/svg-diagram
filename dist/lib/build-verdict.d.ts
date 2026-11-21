import type { RenderResult } from './types/verdicts.ts';
/** Check the render result before writing SVG or reusing its layout for a missing map. */
export declare function assertBuildOutput({ verdict, laidOut, xml }: Pick<RenderResult, 'verdict' | 'laidOut' | 'xml'>, outPath: string): void;
