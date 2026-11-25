import { image } from './image.ts';
import type { Diagram } from '../types/core.ts';
import type { BuildResult } from '../types/verdicts.ts';
import { math } from './math.ts';
declare const locatedImage: typeof image;
export { locatedImage as image };
export declare function build(d: Diagram, outPath: string, opts?: {
    lint?: boolean;
    name?: string;
    html?: boolean;
}): Promise<BuildResult>;
declare const locatedMath: typeof math;
export { locatedMath as math };
