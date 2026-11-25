import type { GridBand } from './types/containers.ts';
import type { Finding } from './types/verdicts.ts';
export declare function canvasRegionFindings(b: GridBand): Finding[];
export declare const gridRules: Readonly<{
    readonly 'canvas-region-empty': {
        readonly doc: 'canvas() の領域に内容がない（requireAll: 全領域を埋める指定）';
        readonly scope: 'band';
    };
}>;
